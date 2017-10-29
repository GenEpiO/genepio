#!/usr/bin/python
# -*- coding: utf-8 -*-

""" 
****************************************************
make_standard.py
Author: Damion Dooley

This script prepares a data standard ontology file from a given ontology file
and specification identifier (within the ontology) and writes it to a 
stand-alone ontology file. Conversion to the output ontology file involves some
transformations to achieve simplicity and clarity.  The main ontology file is
designed to accomodate multiple standards, and labels, definitions and database
field names and other standards-specific information are kept as annotations on
a standard's term's 'member_of' link to that standard. Such information is 
promoted to annotations on the term itself (and will replace any existing 
defaults).

USAGE
    > python make_standard.py [source ontology file] [standard id] [output file name]
	example: python make_standard.py genepio-edit.owl obo:GENEPIO_0002083 test.owl
INPUT
	[source ontology file]: an OBOFoundry ontology file which supports simple standards description
	[standard id]: ontology identifier of standards item, e.g. 

NOTES
    - RDFLib sparql ISSUE: Doing a binding x on a (?x as ?y) expression leads
      to no such field being output.

**************************************************** 
""" 

import re
from pprint import pprint
import optparse
import sys
import os
from ontoutils import OntoUtils
from subprocess import call

#import rdflib
import rdflib.plugins.sparql

# Do this, otherwise a warning appears on stdout: No handlers could be found for logger "rdflib.term"
import logging; logging.basicConfig(level=logging.ERROR) 

try: #Python 2.7
	from collections import OrderedDict
except ImportError: # Python 2.6
	from ordereddict import OrderedDict


class MyParser(optparse.OptionParser):
	"""
	Allows formatted help info.  From http://stackoverflow.com/questions/1857346/python-optparse-how-to-include-additional-info-in-usage-output.
	"""
	def format_epilog(self, formatter):
		return self.epilog


class OntoMaker(object):
	"""
	Read in an ontology file that contains a standard. Run Sparql 1.1 UPDATE and DELETE
	queries on it, and write out results in a separate file dedicated to the standard.
	"""
	CODE_VERSION = '0.0.1'

	def __init__(self):

		# Eventually queries will depend on peculiarities of requested standards identifier?
		self.queries = {
			'get_data_standard': r"""
				SELECT DISTINCT ?subject
					WHERE {
						{?subject rdfs:subClassOf* ?root } # draft sequence repository contextual data standard
						UNION { 
						?restriction owl:onProperty obo:RO_0002180 . # has_component 
						?restriction owl:onClass ?subjectroot .
						?subject rdfs:subClassOf* ?subjectroot .
						?child rdfs:subClassOf ?restriction .
						?child rdfs:subClassOf+ ?root
					}
				}
			""",

			# ################################################################
			# 
			# Update/Delete queries are below. These queries are straight strings.

			# Connect 'province (Canada)' as 'located in' 'Canada'
			# Or connect each province separately?
			'province in canada': """
				INSERT {?entity obo:RO_0001025 obo:GAZ_00002560}
				WHERE {VALUES ?entity {obo:GAZ_00002561}
				}
			""",

			# Case of type:city wrongly associated with Gazetteer country 
			'delete city type':"""
				DELETE {?entity rdf:type obo:ENVO_00000856}
				WHERE {?entity rdf:type obo:ENVO_00000856}
			"""
		}


	def __main__(self): #, input_ontology_file
		"""

		"""
		(options, args) = self.get_command_line()

		if options.code_version:
			print CODE_VERSION
			return CODE_VERSION

		self.onto = OntoUtils(queries=self.queries)
		self.newonto = OntoUtils()

		if not len(args):
			self.onto.stop_err('Please supply an OWL ontology file (in XML/RDF format)')

		if len(args) == 1:
			self.onto.stop_err('Please supply an OWL ontology identifier that indicates the standard you wish to extract.')

		if len(args) == 2:
			self.onto.stop_err('Please supply an output file to write the extracted ontology to.')

		input_ontology_file = self.onto.get_folder(args[0], "Ontology file") #accepts relative path with file name
		if not os.path.isfile(input_ontology_file):
			self.onto.stop_err('Please check the input OWL ontology file path')			

		output_ontology_file = self.onto.get_folder(args[2], "Ontology file")
		if not output_ontology_file:
			self.onto.stop_err('Please check the OWL ontology file path')	

		print "PROCESSING " + input_ontology_file + " ..."

		# Get ontology core filename, without .owl suffix
		#ontology_filename = os.path.basename(input_ontology_file).rsplit('.',1)[0]

		#http://rdflib.readthedocs.io/en/stable/apidocs/rdflib.html
		# parse(source=None, publicID=None, format=None, location=None, file=None, data=None, **args)[source]
		# Parse source adding the resulting triples to the Graph.
		# The source is specified using one of source, location, file or data.
		self.onto.graph.parse(source=input_ontology_file) # PROVIDE data=XXXX if input is TEXT rather than file path.

		print("graph has %s statements." % len(self.onto.graph))

		# ONTOLOGY IMPORT FILES
		# Add each ontology include file (must be in OWL RDF format)
		#self.onto.get_ontology_imports(os.path.dirname(input_ontology_file) + '/imports')

		# Temporarily write merged ontology
		with (open(output_ontology_file, 'w')) as output_handle:
			output_handle.write(self.onto.graph.serialize(format='pretty-xml') )

		# Extract entities from the ontology given in 'get_data_standard' query
		# Make binding for standard's ontology entity
	"""
		initBinds = {'root': rdflib.URIRef(self.onto.get_expanded_id(args[1]))} 
		entity_results = self.onto.get_query_table('get_data_standard', initBinds) # Fetches all main ids via get_component and subClassOf

		entity_ids = []
		print "Importing ", len(entity_results), " terms"
		for row in entity_results:
			if 'subject' in row: entity_ids.append(row['subject'])

		with (open('./make_standard_ids.txt', 'w')) as output_handle:
			output_handle.write('	'.join(entity_ids))

		# Fetch all {?id ?type ?object}
		# Write owl file back out (it is in rdf/xml format).
		print "Output to", output_ontology_file
		call("robot extract --method STAR --input %s --term-file './make_standard_ids.txt' --output %s.test" % (output_ontology_file, output_ontology_file) )
	"""
		# We have the ids and we want to know everything about them.

		#self.onto.graph.add((rdflib.URIRef('http://purl.obolibrary.org/obo/GENEPIO/imports/gazetteer_import-converted.owl'), RDF.type, OWL.Ontology ))

		#with (open(output_ontology_file, 'w')) as output_handle:
		#	output_handle.write(self.newonto.graph.serialize(format='pretty-xml') )



		# KNOCK OUT LINKS TO OTHER 
	
	############################## UTILITIES ###########################

	def get_command_line(self):
		"""
		*************************** Parse Command Line *****************************
		"""
		parser = MyParser(
			description = 'Produce a stand-alone ontology file for given standard. See https://github.com/GenEpiO/genepio',
			usage = '%prog [input ontology file path] [standard term\'s identifier] [output ontology file]',
			epilog="""  """)
		
		# Standard code version identifier.
		parser.add_option('-v', '--version', dest='code_version', default=False, action='store_true', help='Return version of this code.')
		#parser.add_option('-o', '--output', dest='output_file', action='store_true', help='Output ontology to this file.')
		#parser.add_option('-i', '--input', dest='input_file', action='store_true', help='Output ontology to this file.')

		return parser.parse_args()


if __name__ == '__main__':

	myontology = OntoMaker()
	myontology.__main__()

