#!/usr/bin/python
# -*- coding: utf-8 -*-

""" 
****************************************************
ontology_query.py
Author: Damion Dooley

This script runs a given SPARQL select query on a given ontology.  The 
ontology is the first parameter, followed by the SPARQL query. Output
currently is printed to stdio.  First line contains SPARQL variable names, 
and remaining lines contain the result rows.

python ontology_query.py genepio-merged.owl test.sparql

Example test.sparql file: A generic class hierarchy from given root.

	SELECT DISTINCT ?id ?parent ?label ?uiLabel ?definition
	WHERE {	
		#?parent rdfs:subClassOf* ?root.
		?id rdfs:subClassOf ?parent.
		OPTIONAL {?id rdfs:label ?label}.
		OPTIONAL {?id obo:GENEPIO_0000006 ?uiLabel}.
		OPTIONAL {?id obo:IAO_0000115 ?definition.}
	}
	ORDER BY ?parent ?label ?uiLabel


Add these PREFIXES to Protege Sparql query window if you want to test a query there:

	PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> 
	PREFIX owl: <http://www.w3.org/2002/07/owl#>
	PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> 
	PREFIX obo: <http://purl.obolibrary.org/obo/>
	PREFIX xmls: <http://www.w3.org/2001/XMLSchema#>

FUTURE: Can we use this approach from rdflib docs?

	3.1.4 Plugin query results
		Plugins for reading and writing of (SPARQL) QueryResult - pass name to either parse() or serialize()
		Parsers
		Name Class
			csv CSVResultParser
			json JSONResultParser
			tsv TSVResultParser
			xml XMLResultParser
			Serializers
		Name Class
			csv CSVResultSerializer
			json JSONResultSerializer
			txt TXTResultSerializer
			xml XMLResultSerializer

**************************************************** 
""" 

import optparse
import sys
import os
import rdflib
from rdflib.plugins.sparql.parser import parseUpdate
from rdflib.plugins.sparql import prepareQuery
from rdflib.plugins.sparql import processUpdate
from rdflib.parser import Parser
from rdflib import plugin

import rdfextras; rdfextras.registerplugins() # so we can Graph.query()
from rdflib.namespace import OWL, RDF, RDFS

# Do this, otherwise a warning appears on stdout: No handlers could be found for logger "rdflib.term"
import logging; logging.basicConfig(level=logging.ERROR) 

CODE_VERSION = '0.0.2'

def stop_err( msg, exit_code=1 ):
	sys.stderr.write("%s\n" % msg)
	sys.exit(exit_code)

class MyParser(optparse.OptionParser):
	"""
	Allows formatted help info.  From http://stackoverflow.com/questions/1857346/python-optparse-how-to-include-additional-info-in-usage-output.
	"""
	def format_epilog(self, formatter):
		return self.epilog

class OntologyQuery(object):
	"""
	Read in an ontology file. Run Sparql 1.1 UPDATE and DELETE
	queries on it.
	"""
	namespace = { 
		'owl': rdflib.URIRef('http://www.w3.org/2002/07/owl#'),
		'rdfs': rdflib.URIRef('http://www.w3.org/2000/01/rdf-schema#'),
		'obo': rdflib.URIRef('http://purl.obolibrary.org/obo/'),
		'rdf': rdflib.URIRef('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
		'xmls': rdflib.URIRef('http://www.w3.org/2001/XMLSchema#'),
		'oboInOwl': rdflib.URIRef('http://www.geneontology.org/formats/oboInOwl#')
	}

	def __init__(self):

		self.graph=rdflib.Graph()


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

		query_file = args[1] #accepts relative path with file name
		query_file = self.check_folder(query_file, "Query file")
		if not os.path.isfile(query_file):
			stop_err('Please check the OWL ontology file path')	

		print ("PROCESSING " + args[0] + " and " + args[1])

		# Get ontology core filename, without .owl suffix
		ontology_filename = os.path.basename(main_ontology_file).rsplit('.',1)[0];

		self.graph.parse(source=main_ontology_file);

		with open (query_file) as fh:
			query_text = fh.read();
			query = prepareQuery(query_text, initNs = self.namespace);
			result = self.doQuery(query);

		lines = []

		header = False
		for row in result:
			if (header == False):
				columns = row.asdict().keys();
				lines.append('	'.join(columns));
				header = True

			values = [];
			for column in columns:
				values.append(str(row[column]).replace('	','')); #remove imbedded tabs

			lines.append('	'.join(values));

		print('\n'.join(lines))

		# Write output file
		#fh = open('ontology_output.tsv', 'w')
		#fh.writelines(lines)
		#fh.close();
	
	############################## UTILITIES ###########################


	def doQuery(self, query, initBinds = {}):
		"""
		Given a sparql 1.1 update query, perform it. 
		"""

		try:
			result = self.graph.query(query, initBindings=initBinds, initNs=self.namespace)

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


if __name__ == '__main__':

	myontology = OntologyQuery()
	myontology.__main__()

