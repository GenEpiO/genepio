#!/usr/bin/python
# -*- coding: utf-8 -*-

""" 
****************************************************
ontology_modify.py
Author: Damion Dooley

This script runs specific SPARQL select/create/update/delete queries on a given
ontology.  Queries are hard-baked below. Modified ontology is saved in place.

python ontology_modify.py test.owl

**************************************************** 
""" 

import optparse
import sys
import os
import rdflib
from rdflib.plugins.sparql.parser import parseUpdate
from rdflib.plugins.sparql import prepareQuery
from rdflib.plugins.sparql import processUpdate
import rdfextras; rdfextras.registerplugins() # so we can Graph.query()
from rdflib.namespace import OWL, RDF, RDFS

# Do this, otherwise a warning appears on stdout: No handlers could be found for logger "rdflib.term"
import logging; logging.basicConfig(level=logging.ERROR) 

CODE_VERSION = '0.0.1'

def stop_err( msg, exit_code=1 ):
	sys.stderr.write("%s\n" % msg)
	sys.exit(exit_code)

class MyParser(optparse.OptionParser):
	"""
	Allows formatted help info.  From http://stackoverflow.com/questions/1857346/python-optparse-how-to-include-additional-info-in-usage-output.
	"""
	def format_epilog(self, formatter):
		return self.epilog

class OntologyUpdate(object):
	"""
	Read in an ontology file. Run Sparql 1.1 UPDATE and DELETE
	queries on it.
	"""

	def __init__(self):

		self.graph=rdflib.Graph()

		self.struct = {}
		# JSON-LD @context markup, and as well its used for a prefix encoding table.
		self.struct['@context'] = {
			'obo':'http://purl.obolibrary.org/obo/',
			'owl':'http://www.w3.org/2002/07/owl#',
			'oboInOwl': 'http://www.geneontology.org/formats/oboInOwl#'
		}


	def __main__(self): #, main_ontology_file
		"""

		"""
		(options, args) = self.get_command_line()

		if options.code_version:
			print (CODE_VERSION)
			return CODE_VERSION

		if not len(args):
			stop_err('Please supply an OWL ontology file (in XML/RDF format)')

		main_ontology_file = args[0] #accepts relative path with file name
		main_ontology_file = self.check_folder(main_ontology_file, "Ontology file")
		if not os.path.isfile(main_ontology_file):
			stop_err('Please check the OWL ontology file path')			

		print ("PROCESSING " + main_ontology_file + " ...")

		# Get ontology core filename, without .owl suffix
		ontology_filename = os.path.basename(main_ontology_file).rsplit('.',1)[0]

		self.graph.parse(source=main_ontology_file) 
		
		print (self.doQueryUpdate('delete labels')) # list of labels to delete
		#print (self.doQueryUpdate('convert labels')) # list of labels to convert to 'alternate label'

		# Write owl file
		if (self.graph):
			self.graph.serialize(destination=main_ontology_file, format='pretty-xml')
		else:
			print ("Error: No graph output.")

	
	############################## UTILITIES ###########################


	def doQueryUpdate(self, query_name, initBinds = {}):
		"""
		Given a sparql 1.1 update query, perform it. 
		"""

		query = self.queries[query_name]

		try:
			result = processUpdate(self.graph, self.prefixes + query, initBindings=initBinds, initNs=self.namespace)
			#result = parseUpdate(self.graph, self.prefixes + query, initBindings=initBinds, initNs=self.namespace)
			#self.graph.query(self.prefixes + query, initBindings=initBinds, initNs=self.namespace)

		except Exception as e:
			print ("\nSparql query [%s] parsing problem: %s \n" % (query_name, str(e) ))
			return None

		return result


	def get_command_line(self):
		"""
		*************************** Parse Command Line *****************************
		"""
		parser = MyParser(
			description = 'Ontology modification script.',
			usage = 'ontology_modify.py [ontology file path] [options]*',
			epilog="""  """)
		
		# Standard code version identifier.
		parser.add_option('-v', '--version', dest='code_version', default=False, action='store_true', help='Return version of this code.')

		return parser.parse_args()


	def check_folder(self, file_path, message = "Directory for "):
		"""
		Ensures file folder path for a file exists.
		It can be a relative path.
		"""
		if file_path != None:

			path = os.path.normpath(file_path)
			if not os.path.isdir(os.path.dirname(path)): 
				# Not an absolute path, so try default folder where script launched from:
				path = os.path.normpath(os.path.join(os.getcwd(), path) )
				if not os.path.isdir(os.path.dirname(path)):
					stop_err(message + "[" + path + "] does not exist!")			
					
			return path
		return None


	""" 
	Add these PREFIXES to Protege Sparql query window if you want to test a query there:
	"""
	prefixes = r"""
	PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> 
	PREFIX owl: <http://www.w3.org/2002/07/owl#>
	PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> 
	PREFIX obo: <http://purl.obolibrary.org/obo/>
	PREFIX xmls: <http://www.w3.org/2001/XMLSchema#>
	""" 
	namespace = { 
		'owl': rdflib.URIRef('http://www.w3.org/2002/07/owl#'),
		'rdfs': rdflib.URIRef('http://www.w3.org/2000/01/rdf-schema#'),
		'obo': rdflib.URIRef('http://purl.obolibrary.org/obo/'),
		'rdf': rdflib.URIRef('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
		'xmls': rdflib.URIRef('http://www.w3.org/2001/XMLSchema#'),
		'oboInOwl': rdflib.URIRef('http://www.geneontology.org/formats/oboInOwl#')
	}

	queries = {
		##################################################################
		# EXAMPLE: Generic TREE "is a" hierarchy from given root.
		# FUTURE: ADD SORTING OPTIONS, CUSTOM ORDER.
		#
		'tree': prepareQuery("""
			SELECT DISTINCT ?id ?parent ?label ?uiLabel ?definition
			WHERE {	
				?parent rdfs:subClassOf* ?root.
				?id rdfs:subClassOf ?parent.
				OPTIONAL {?id rdfs:label ?label}.
				OPTIONAL {?id obo:GENEPIO_0000006 ?uiLabel}.
				OPTIONAL {?id obo:IAO_0000115 ?definition.}
			}
			ORDER BY ?parent ?label ?uiLabel
		""", initNs = namespace),

		# ################################################################
		# 
		# Update/Delete queries are below. These queries are straight strings.
		# 
		# WARNING: THIS QUERY PROCESSOR THROWS SYNTAX ERROR IF NO SPACE BEFORE PERIOD 
		#

		'delete labels': """
		DELETE {?entity rdfs:label ?label}
		WHERE {
			VALUES ?entity {
			[... obo:FOODON_03420108 ...]
			} 
			?entity rdfs:label ?label .
		}
		""",

		# Switch given label to alternative term
		# Note: "DELETE" must come before "INSERT"
		'convert labels': """
			DELETE {?entity rdfs:label ?label}
			INSERT {?entity obo:IAO_0000118 ?label}
			WHERE {
				VALUES ?entity {
				[... obo:FOODON_03420108 ...]
				} 
				?entity rdfs:label ?label .
			}
		"""
}

if __name__ == '__main__':

	myontology = OntologyUpdate()
	myontology.__main__()

