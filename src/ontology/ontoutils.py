#!/usr/bin/python
# -*- coding: utf-8 -*-

""" 
****************************************************
 ontoutils.py
 Author: Damion Dooley
 
 
 RDFLib sparql ISSUE: Doing a binding x on a (?x as ?y) expression bug leads to no such field being output.

**************************************************** 
""" 
	

import re
import json
import sys
import os
from pprint import pprint

# WARNING: processUpdate COLLIDES with something else in rdflib it seems, yeilding spurious "Exception: I need a URIRef or path as predicate, not Path(http://www.w3.org/2000/01/rdf-schema#subClassOf*)" type of error when get_query_table() is run.
#from rdflib_sparql.processor import processUpdate


import rdflib
import rdfextras; rdfextras.registerplugins() # so we can Graph.query()
from rdflib.namespace import OWL, RDF, RDFS


# Do this, otherwise a warning appears on stdout: No handlers could be found for logger "rdflib.term"
import logging; logging.basicConfig(level=logging.ERROR) 

try: #Python 2.7
	from collections import OrderedDict
except ImportError: # Python 2.6
	from ordereddict import OrderedDict

class OntoUtils(object):
	"""
	Various utility functions for reading in and manipulating an owl ontology
	using rdflib.  Some elements set up for OBOFoundry use.
	"""
	CODE_VERSION = '0.0.3'
	STRING_DATATYPE = rdflib.term.URIRef('http://www.w3.org/2001/XMLSchema#string')

	# Future: auto-generate from given ontology RDF file.
	xml_entities = {
			'ifm':'http://purl.obolibrary.org/obo/GENEPIO/IFM#',  
			'NCBITaxon' : 'http://purl.obolibrary.org/obo/NCBITaxon#',
			'obo':'http://purl.obolibrary.org/obo/', # Must be ordered AFTER all obo ontologies
			'owl':'http://www.w3.org/2002/07/owl/',
			'evs':'http://ncicb.nci.nih.gov/xml/owl/EVS/',
			'sio':'http://semanticscience.org/resource/',
			'ndf-rt':'http://evs.nci.nih.gov/ftp1/NDF-RT/NDF-RT.owl#',
			'xmls':'http://www.w3.org/2001/XMLSchema#',
			'vcard':'http://www.w3.org/2006/vcard/ns#',
			'mesh':'http://purl.bioontology.org/ontology/MESH/',
			'typon':'http://purl.phyloviz.net/ontology/typon#',
			'vcf':'http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl#',
			'eo':'http://epidemiology_ontology.owl#',
			'bibo':'http://purl.org/ontology/bibo/',
			'efo':'http://www.ebi.ac.uk/efo/',
			'oboInOwl': 'http://www.geneontology.org/formats/oboInOwl#',
			'ancestro': 'http://www.ebi.ac.uk/ancestro/',
			'rdfs': 'http://www.w3.org/2000/01/rdf-schema#'
		}

	namespace = { 
		'owl': rdflib.URIRef('http://www.w3.org/2002/07/owl#'),
		'rdfs': rdflib.URIRef('http://www.w3.org/2000/01/rdf-schema#'),
		'obo': rdflib.URIRef('http://purl.obolibrary.org/obo/'),
		'rdf': rdflib.URIRef('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
		'xmls': rdflib.URIRef('http://www.w3.org/2001/XMLSchema#'),
		'oboInOwl': rdflib.URIRef('http://www.geneontology.org/formats/oboInOwl#')
	}

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

	queries = {
		##################################################################
		# Generic TREE "is a" hierarchy from given root.
		# FUTURE: ADD SORTING OPTIONS, CUSTOM ORDER.
		#
		'tree': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?parent
			WHERE {	
				?parent rdfs:subClassOf* ?root.
				?id rdfs:subClassOf ?parent.
				OPTIONAL {?id rdfs:label ?label}.
			}
			ORDER BY ?parent ?label
		""", initNs = namespace)
		# Continue additional generic queries by name here:

	}

	def __init__(self, namespace={}, prefixes='', newqueries={}):

		self.graph = rdflib.Graph()

		self.namespace.update(namespace)
		self.prefixes += prefixes
		# run all given "SELECT" queries through prepareQuery function.
		for (id, query) in newqueries.iteritems():
			leader = query.strip()[0:6]
			if leader == 'SELECT': # prepareQuery only works on SELECT ...
				self.queries[id] = rdflib.plugins.sparql.prepareQuery(query, initNs = self.namespace)
				print "Adding SELECT query"

			elif leader == 'DELETE' or leader == 'INSERT':
				self.queries[id] = query
				print "Adding DEL/INS query"
		#self.queries.update(queries)
		#print "Done query prep."


	def stop_err(self, msg, exit_code=1 ):
		sys.stderr.write("%s\n" % msg)
		sys.exit(exit_code)


	def get_bindings(self, myDict):
		obj = {}
		for entity in myDict:
			obj[entity] = myDict[entity]

		return obj

	def get_parent_id(self, myDict):
		if 'parent' in myDict: 
			return str(myDict['parent']) # Sometimes binary nodes are returned
		return None

	def set_struct_path(self, focus,*args):
		# Create a recursive dictionary path from focus ... to n-1 args, and 
		# set it to value provided in last argument
		value = args[-1]
		for ptr, arg in enumerate(args[0:-1]):
			if not arg in focus: focus[arg]={}
			if ptr == len(args)-2:
				focus[arg] = value 
			else:
				focus = focus[arg]


	def set_struct_default_path(self, focus,*args):
		""" 
			Same as set_struct() but won't create path; it will only use existing path.
		"""
		if not focus:
			print ( "ERROR: in set_default(), no focus for setting: %s" % str(args[0:-1]) )
			return None

		value = args[-1]
		for ptr, arg in enumerate(args[0:-1]):
			#arg = str(arg) # binary nodes are objects
			if not arg: self.stop_err( "ERROR: in set_default(), an argument isn't set: %s" % str(args[0:-1]) ) 
			if ptr == len(args)-2:
				if not arg in focus:
					focus[arg] = value
				return focus[arg]

			elif not arg in focus: 
				print ( "ERROR: in set_default(), couldn't find %s" % str(args[0:-1]) )
				return False
			else:
				focus = focus[arg]


	def get_struct_path(self, focus, *args):
		"""
			Navigate from focus object dictionary hierarchy down through 
			textual keys, returning value of last key.
		"""
		try:
			for arg in args:
				focus = focus[arg]
		except:
			print "ERROR: in getStruct(), couldn't find '%s' key or struct in %s" % (str(arg), str(args) )
			return None
		return focus


	def get_extracted_id(self, URI):
		# If a URI has a recognized value from xml_entities, create shortened version
		if '/' in URI or r'#' in URI: 
			(prefix, myid) = URI.rsplit('#',1) if '#' in URI else URI.rsplit(r'/',1) # Need '#' first!
			for key, value in self.xml_entities.iteritems():
				if value[0:-1] == prefix: 
					return key+":"+myid
			
		return URI 


	def get_expanded_id(self, URI):
		# If a URI has a recognized prefix, create full version
		if ':' in URI: 
			(prefix, myid) = URI.rsplit(':',1)
			for key, value in self.xml_entities.iteritems():
				if key == prefix: 
					return value+myid
			
		return URI 


	def get_ontology_imports(self, ontology_file_path='./imports/'):
		"""
		Detects all the import files in a loaded OWL ontology graph and adds them to the graph.
		Currently assumes imports are sitting in a folder called "imports" in parent folder of this script. 
		"""
		query = rdflib.plugins.sparql.prepareQuery("""
			SELECT distinct ?import_file
			WHERE {?s owl:imports ?import_file . }
			ORDER BY (?import_file)
		""", initNs = self.namespace)

		imports = self.graph.query(query, initNs = self.namespace)

		print("It has %s import files ..." % len(imports))

		for result_row in imports: # a rdflib.query.ResultRow
			file = result_row.import_file.rsplit('/',1)[1]
			file_path = ontology_file_path + '/' + file
			try:
				if os.path.isfile( file_path):
					self.graph.parse(file_path)	
				else:
					print ('WARNING:' + file_path + " could not be loaded!  Does its ontology include purl have a corresponding local file? \n")

			except rdflib.exceptions.ParserError as e:
				print (file_path + " needs to be in RDF OWL format!")			


	def get_folder(self, file_path, message = "Directory for "):
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
					self.stop_err(message + "[" + path + "] does not exist!")			
					
			return path
		return None


############################# SPARQL UTILITIES ################################

	def do_query_update(self, query_name, initBinds = {}):
		"""
		Given a sparql 1.1 update query, perform it. 
		"""

		query = self.queries[query_name]

		try:
			# Doesn't work?! fails silently.
			result = self.graph.update(self.prefixes + query, initBindings=initBinds, initNs=self.namespace)
			#result = processUpdate(self.graph, self.prefixes + query, initBindings=initBinds, initNs=self.namespace)
		except Exception as e:
			print ("\nSparql query [%s] parsing problem: %s \n" % (query_name, str(e) ))
			return None

		return result


	def get_query_table(self, query_name, initBinds = {}):
		"""
		Given a sparql 1.1 query, returns a list of objects, one for each row result
		Simplifies XML/RDF URI http://... references down to a known ontology entity prefix

		If SPARQL lines  with "." don't have space before period:
		rdfquery parsing issue: expandUnicodeEscapes
    	return expandUnicodeEscapes_re.sub(expand, q)
		TypeError: expected string or buffer
		"""

		query = self.queries[query_name]

		try:
			result = self.graph.query(query, initBindings=initBinds)
		except Exception as e:
			print ("\nSparql query [%s] parsing problem: %s \n" % (query_name, str(e) ))
			return None

		# Can't get columns by row.asdict().keys() because columns with null results won't be included in a row.
		# Handles "... SELECT DISTINCT (?something as ?somethingelse) ?this ?and ?that WHERE ....""
		#columns = re.search(r"(?mi)\s*SELECT(\s+DISTINCT)?\s+((\?\w+\s+|\(\??\w+\s+as\s+\?\w+\)\s*)+)\s*WHERE", query)
		#columns = re.findall(r"\s+\?(?P<name>\w+)\)?", columns.group(2))

		table = []
		for ptr, row in enumerate(result):
			rowdict = row.asdict()
			newrowdict = {}

			for column in rowdict:

				# Each value has a datatype defined by RDF Parser: URIRef, Literal, BNode
				value = rowdict[column]
				valType = type(value) 
				if valType is rdflib.term.URIRef : 
					newrowdict[column] = self.get_extracted_id(value)  # a plain string

				elif valType is rdflib.term.Literal :
					literal = {'value': value.replace('\n', r'\n')} # Text may include carriage returns; escape to json
					#_invalid_uri_chars = '<>" {}|\\^`'

					if hasattr(value, 'datatype'): #rdf:datatype
						#Convert literal back to straight string if its datatype is simply xmls:string
						if value.datatype == None or value.datatype == self.STRING_DATATYPE:
							literal = literal['value']
						else:
							literal['datatype'] = self.get_extracted_id(value.datatype)															

					elif hasattr(value, 'language'): # e.g.  xml:lang="en"
						#A query Literal won't have a language if its the result of str(?whatever) !
						literal['language'] = self.get_extracted_id(value.language)
					
					else: # WHAT OTHER OPTIONS?
						literal = literal['value']

					newrowdict[column] = literal

				elif valType is rdflib.term.BNode:
					"""
					Convert a variety of BNode structures into something simple.
					E.g. "(province or state or territory)" is a BNode structure coded like
					 	<owl:someValuesFrom> 
							<owl:Class>
								<owl:unionOf rdf:parseType="Collection">
                    			   <rdf:Description rdf:about="&resource;SIO_000661"/> 
                    			   <rdf:Description rdf:about="&resource;SIO_000662"/>
                    			   ...
                    """
                    # Here we fetch list of items in disjunction
					disjunction = self.graph.query(
						"SELECT ?id WHERE {?datum owl:unionOf/rdf:rest*/rdf:first ?id}", 
						initBindings={'datum': value} )		
					results = [self.get_extracted_id(item[0]) for item in disjunction] 
					newrowdict['expression'] = {'datatype':'disjunction', 'data':results}

					newrowdict[column] = value

				else:

					newrowdict[column] = {'value': 'unrecognized column [%s] type %s for value %s' % (column, type(value), value)}

			table.append(newrowdict)

		return table

