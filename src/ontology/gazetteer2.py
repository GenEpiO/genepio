#!/usr/bin/python
# -*- coding: utf-8 -*-

""" 
****************************************************
gazetteer2.py
Author: Damion Dooley

This script normalizes a Gazetteer file (assumed coming from Ontofox)
in a number of ways for GenEpiO & other application ontology usage:

Though GAZETTEER mostly favours individuals, it has 400 classes or puns for 
things like "Antarctica". We need more consistency to power country / state
/ province / region / territory menus.
		
Note that cases of 'located in' actually have one of two semantic interpretations:
	1) strict geographic parthood where object is geographical (a name not having direct political significance). 
	2) Political Entity parthood where object is a political entity.

 python gazetteer.py import/gazetteer_import.owl

 RDFLib sparql ISSUE: Doing a binding x on a (?x as ?y) expression bug leads to no such field being output.

**************************************************** 
""" 

import re
from pprint import pprint
import optparse
import sys
import os
import rdflib
#import rdflib.plugins.sparql as sparql
from rdflib_sparql.processor import processUpdate
import rdfextras; rdfextras.registerplugins() # so we can Graph.query()
from rdflib.namespace import OWL, RDF, RDFS

# Do this, otherwise a warning appears on stdout: No handlers could be found for logger "rdflib.term"
import logging; logging.basicConfig(level=logging.ERROR) 

try: #Python 2.7
	from collections import OrderedDict
except ImportError: # Python 2.6
	from ordereddict import OrderedDict


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

class OntologyHammer(object):
	"""
	Read in an ontology file. Run Sparql 1.1 UPDATE and DELETE
	queries on it.
	"""

	def __init__(self):

		self.graph=rdflib.Graph()

		self.struct = OrderedDict()
		# JSON-LD @context markup, and as well its used for a prefix encoding table.
		# Might need some of these prefixes for GAZETTEER related geo terms
		self.struct['@context'] = {
			'ifm':'http://purl.obolibrary.org/obo/GENEPIO/IFM#',  # Must be ordered 1st or obo usurps.
			'obo':'http://purl.obolibrary.org/obo/',
			'owl':'http://www.w3.org/2002/07/owl/',
			'sio':'http://semanticscience.org/resource/',
			'oboInOwl': 'http://www.geneontology.org/formats/oboInOwl#'
		}
		self.struct['specifications'] = {}


	def __main__(self): #, main_ontology_file
		"""

		"""
		(options, args) = self.get_command_line()

		if options.code_version:
			print CODE_VERSION
			return CODE_VERSION

		if not len(args):
			stop_err('Please supply an OWL ontology file (in XML/RDF format)')

		main_ontology_file = args[0] #accepts relative path with file name
		main_ontology_file = self.check_folder(main_ontology_file, "Ontology file")
		if not os.path.isfile(main_ontology_file):
			stop_err('Please check the OWL ontology file path')			

		print "PROCESSING " + main_ontology_file + " ..."

		# Get ontology core filename, without .owl suffix
		ontology_filename = os.path.basename(main_ontology_file).rsplit('.',1)[0]

		self.graph.parse(source=main_ontology_file) 
		# Get stuff under OBI data_representational_model
		#root_term = rdflib.URIRef(self.expandId('obo:OBI_0000658'))
		#specBinding={'root': root_term} 
		#self.struct['specifications'] = self.doQueryTable('tree', specBinding)
		
		print self.doQueryUpdate('insert USAstate') # Fixing that states not connected to USA directly.
		print self.doQueryUpdate('link countries') # Lots of GAZETTEER countries not linked to ENVO_00000009 nation
		print self.doQueryUpdate('ncit countries') # Currently using NCIT term as base for country list.
		print self.doQueryUpdate('delete undersea features') # 6 canadian provinces mistakenly linked to these
		print self.doQueryUpdate('delete undersea class')
		print self.doQueryUpdate('province in canada')
		print self.doQueryUpdate('delete city type') # Case of type:city wrongly associated with Gazetteer country 

		# Write owl file
		#self.graph.add((rdflib.URIRef('http://purl.obolibrary.org/obo/GENEPIO/imports/gazetteer_import-converted.owl'), RDF.type, OWL.Ontology ))
		with (open(main_ontology_file, 'w')) as output_handle:
		#with (open('./gazetteer_import.owl', 'w')) as output_handle:
			output_handle.write(self.graph.serialize(format='pretty-xml') )


	
	############################## UTILITIES ###########################


	def expandId(self, URI):
		# If a URI has a recognized prefix, create full version
		if ':' in URI: 
			(prefix, myid) = URI.rsplit(':',1)
			for key, value in self.struct['@context'].iteritems():
				if key == prefix: return value+myid
			
		return URI 


	def doQueryUpdate(self, query_name, initBinds = {}):
		"""
		Given a sparql 1.1 update query, perform it. 
		"""

		query = self.queries[query_name]

		try:
			# Doesn't work?! fails silently.
			#result = self.graph.update(self.prefixes + query, initBindings=initBinds, initNs=self.namespace)
			result = processUpdate(self.graph, self.prefixes + query, initBindings=initBinds, initNs=self.namespace)
		except Exception as e:
			print ("\nSparql query [%s] parsing problem: %s \n" % (query_name, str(e) ))
			return None

		return result


	def get_command_line(self):
		"""
		*************************** Parse Command Line *****************************
		"""
		parser = MyParser(
			description = 'Gazetteer normalization process. See https://github.com/GenEpiO/genepio',
			usage = 'gazetteer.py [gazetteer ontology file path] [options]*',
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
		'tree': rdflib.plugins.sparql.prepareQuery("""
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

		# ################################################################
		# Just as Mexico has 'State (United States of Mexico)' we have 
		# organized the US states under, including Alaska and Hawaii.  Right 
		# now they are accessible via some 'East South Central Division' etc. 
		# classes (which should be renamed to indicate USA domain); but we 
		# need a set for statehood directly, and this will encourage reuse of
		# the list in applications.  There are a few NamedIndividual states 
		# 'located in' 'United States of America' in GAZETTEER, but the list
		# isn't comprehensive for some reason.
		# obo:GENEPIO_0001811 = 'State (United States of America)' TEMPORARY?
		#    - Awaiting GAZETTEER request for term.
		# obo:GAZ_00003092 = contiguous United States of America
		# obo:RO_0001025 = 'located in'
		# obo:ENVO_00000009 = 'nation'
		# WARNING: THIS QUERY PROCESSOR THROWS SYNTAX ERROR IF NO SPACE BEFORE PERIOD 
		# USA States ACCIDENTALLY marked as nations due to OBO text mining 
		# issue in setup of GAZETTEER file.
		'insert USAstate': """
		DELETE {?USAstate rdf:type obo:ENVO_00000009}
		INSERT {?USAstate rdf:type obo:GENEPIO_0001811}
		WHERE {VALUES ?USAstate {
			obo:GAZ_00002461 obo:GAZ_00002515 obo:GAZ_00002553 obo:GAZ_00002533
			obo:GAZ_00004444 obo:GAZ_00002518 obo:GAZ_00004413 obo:GAZ_00006254
			obo:GAZ_00006291 obo:GAZ_00002606 obo:GAZ_00004427 obo:GAZ_00002591
			obo:GAZ_00002602 obo:GAZ_00004429 obo:GAZ_00004428 obo:GAZ_00002531
			obo:GAZ_00002537 obo:GAZ_00002519 obo:GAZ_00002514 obo:GAZ_00002878
			obo:GAZ_00002542 obo:GAZ_00002557 obo:GAZ_00002888 obo:GAZ_00002611
			obo:GAZ_00004414 obo:GAZ_00003171 obo:GAZ_00002524 obo:GAZ_00002520
			obo:GAZ_00003175 obo:GAZ_00004411 obo:GAZ_00006881 obo:GAZ_00004440
			obo:GAZ_00004430 obo:GAZ_00002580 obo:GAZ_00004432 obo:GAZ_00002546
			obo:GAZ_00004441 obo:GAZ_00004438 obo:GAZ_00004442 obo:GAZ_00005070
			obo:GAZ_00004435 obo:GAZ_00004443 obo:GAZ_00004431 obo:GAZ_00002539
			obo:GAZ_00002586 obo:GAZ_00003142 obo:GAZ_00004421 obo:GAZ_00004439
			obo:GAZ_00003152 # lower 48 states
			obo:GAZ_00002521 obo:GAZ_00003939 # Alaska, Hawaii
			obo:GAZ_00003957 obo:GAZ_00006935 obo:GAZ_00003706 obo:GAZ_00007113
			obo:GAZ_00003959 # American Samoa, Commonwealth of Puerto Rico, Guam, Minor Outlying Islands, Virgin Islands
			} 
		}
		""",

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
		""",

		'link countries': """
			INSERT {?country rdf:type obo:ENVO_00000009}
			WHERE {VALUES ?country {
				obo:GAZ_00006882 obo:GAZ_00002948 obo:GAZ_00006883 obo:GAZ_00004094 # Afghanistan, Andora, Antigua and Barbuda, Armania
				obo:GAZ_00002942 obo:GAZ_00005281 obo:GAZ_00001251 obo:GAZ_00006886 # Austria, Bahrain, Barbados, Belarus
				obo:GAZ_00003920 obo:GAZ_00002511 obo:GAZ_00001097 obo:GAZ_00000905 # Bhutan, Bolivia, Botswana, Burkina Faso
				obo:GAZ_00002560 obo:GAZ_00001227 obo:GAZ_00000586 obo:GAZ_00005820 # Canada, Cape Verde, Chad, Comoros
				obo:GAZ_00002901 obo:GAZ_00002954 obo:GAZ_00006890 obo:GAZ_00002641 # Costa Rica, Czech Republic, Dominica, England
				obo:GAZ_00000581 obo:GAZ_00000567 obo:GAZ_00006891 obo:GAZ_00002937 # Eritrea, Ethiopia, Fiji, Finland
				obo:GAZ_02000573 obo:GAZ_00000909 obo:GAZ_00002894 obo:GAZ_00002952 # Grenada, Guinea , Honduras, Hungary
				obo:GAZ_00003727 obo:GAZ_00003781 obo:GAZ_00002747 obo:GAZ_00006894 # Indonesia, Jamaica, Japan, Kiribati
				obo:GAZ_00005285 obo:GAZ_00006889 obo:GAZ_00002478 obo:GAZ_00001098 # Kuwait, Laos, Lebanon, Lesthoto
				obo:GAZ_00003858 obo:GAZ_00002947 obo:GAZ_00006895 obo:GAZ_00000584 # Liechtenstein, Luxembourg, Macedonia, Mali
				obo:GAZ_00002852 obo:GAZ_00003897 obo:GAZ_00006900 obo:GAZ_00004399 # Mexico, Moldovia, Nauru, Nepal
				obo:GAZ_00000469 obo:GAZ_00002978 obo:GAZ_00000585 obo:GAZ_00000912 # 'New Zealand', Nicaragua, Niger , Nigeria
				obo:GAZ_00006902 obo:GAZ_00006905 obo:GAZ_00002892 obo:GAZ_00003922 # Niue Fakai, Palau, Panama, Paupa New Guinea
				obo:GAZ_00004525 # The Phillipines
				obo:GAZ_00002933 obo:GAZ_00005286 obo:GAZ_00002721 obo:GAZ_00001087 # Paraguay, Quatar, Russia, Rwanda
				obo:GAZ_00006906 obo:GAZ_00006909 obo:GAZ_02000565 obo:GAZ_00006927 # Saint Kitts-Nevis, Saint Lucia, Saint Vincent and the Grenadines, Sao Tome and Principe
				obo:GAZ_00000913 obo:GAZ_00002957 obo:GAZ_00003923 obo:GAZ_00002956 # Senegal, Serbia , Singapore, Slovak Republic
				obo:GAZ_00000553 obo:GAZ_00003924 obo:GAZ_00001099 obo:GAZ_00002941 # South Africa, Sri Lanka, Swaziland, Switzerland
				obo:GAZ_00006912 obo:GAZ_00006916 obo:GAZ_00003767 obo:GAZ_00000562 # Tajikistan, Tonga,	Trinidad and Tobago, Tunisia
				obo:GAZ_00260188 # Tokelau
				obo:GAZ_00009715 obo:GAZ_00001102 obo:GAZ_00005282 obo:GAZ_00002637 # Tuvalu, Uganda, United Arab Emirates, United Kingdom 
				obo:GAZ_00004979 obo:GAZ_00006918 obo:GAZ_00003103 obo:GAZ_00003756 # Uzbekistan, Vanuatu, Vatican City, Viet Nam
				obo:GAZ_00002640 obo:GAZ_00001107 obo:GAZ_00001106 # Wales, Zambia, Zimbabwe,

			} }
		""",

		'ncit countries': """
			INSERT {?country rdf:type obo:NCIT_C25464}
			WHERE {?country rdf:type obo:ENVO_00000009}
		""",


		# AUTONOMOUS REGION > region (1st level subdivision)
		# GAZ_00004094 Aruba , Kingdom of the Netherlands
		# GAZ_00002848 Autonomous Region (China)

		# AUTONOMOUS PROVINCE > Province
		# GAZ_00005139 Autonomous Province (Serbia)
		# GAZ_00001507 Greenland (Dutch Province)

		# Territory
		# GAZ_00001016 'Capital Territory (Nigeria)'
		# GAZ_02000609 Special Territory (Indonesia)
		# GAZ_00004187 'Union Territory (India)'

		# GAZ_00002516 # Guyana 

		# ISLAND(S)
		# GAZ_00025355 #Borneo (3 separate country parts)
		# GAZ_00001453 # Bouvet Island (Norway)
		# GAZ_00001539 Channel Islands
		# GAZ_00005915 Christmas Island
		# GAZ_00002902 Cocos Island
		# GAZ_00005820 Comoros
		# GAZ_00053798 Cook Islands
		# GAZ_00004021 Curacao Island
		# GAZ_00059206 Faroe Islands
		# GAZ_00004006 Island of Cyprus
		# GAZ_00052477 Isle of Man
		# GAZ_00024383 Java (Indonesian island)
		# GAZ_00006924 Maldives Archipelago'
		# GAZ_00007161 'Marshall Islands'
		# GAZ_00005860 Melanesia
		# GAZ_00005862 Micronesia
		# GAZ_00004019 'Netherlands Antilles' (Netherlands)
		# GAZ_00005200 'New Guinea'
		# GAZ_00007187 'Pitcairn Island'
		# GAZ_00005861 Polynesia
		# GAZ_00003945 Reunion Island
		# GAZ_00012579 Sint Maarten'
		# GAZ_00005275 'Solomon Islands'
		# GAZ_00024553 Sulawesi
		# GAZ_00024432 Sumatra
		# GAZ_00005328 Tahiti
		# GAZ_00007192 'Wallis and Futuna islands'

		# ################################################################

		'delete undersea features': """
		DELETE {?subject rdf:type obo:ENVO_00000104}
		WHERE {?subject rdf:type obo:ENVO_00000104}
		""",

		# BAD GRAPH STRUCTURE IF ONLY THIS IS DONE:
		'delete undersea class': """
		DELETE DATA {obo:ENVO_00000104 rdf:type owl:Class}
		""",

		'report individuals': """
		SELECT ?subject
		WHERE { 	
			?subject rdf:type owl:Class.
			?subject rdf:type owl:NamedIndividual
		}
		"""
}

if __name__ == '__main__':

	myontology = OntologyHammer()
	myontology.__main__()

