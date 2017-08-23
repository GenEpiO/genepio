#!/usr/bin/python
# -*- coding: utf-8 -*-

""" 
****************************************************
	
 Author: Damion Dooley

 
 RDFLib sparql ISSUE: Doing a binding x on a (?x as ?y) expression bug leads to no such field being output.

**************************************************** 
""" 
	

import re
import json
from pprint import pprint
import optparse
import sys
import os

import rdflib
#import rdflib.plugins.sparql as sparql
import rdfextras; rdfextras.registerplugins() # so we can Graph.query()

# Do this, otherwise a warning appears on stdout: No handlers could be found for logger "rdflib.term"
import logging; logging.basicConfig(level=logging.ERROR) 

try: #Python 2.7
	from collections import OrderedDict
except ImportError: # Python 2.6
	from ordereddict import OrderedDict

"""
FOR LOADING JSON AND PRESERVING ORDERED DICT SORTING. NOT RELEVANT YET.
try:	
	import simplejson as json
except ImportError: # Python 2.6
    import json

... rulefileobj =  json.load(rules_handle, object_pairs_hook=OrderedDict)
"""

CODE_VERSION = '0.0.3'

def stop_err( msg, exit_code=1 ):
	sys.stderr.write("%s\n" % msg)
	sys.exit(exit_code)

class MyParser(optparse.OptionParser):
	"""
	Allows formatted help info.  From http://stackoverflow.com/questions/1857346/python-optparse-how-to-include-additional-info-in-usage-output.
	"""
	def format_epilog(self, formatter):
		return self.epilog

class Ontology(object):
	"""
	Read in an ontology and its include files. Run Sparql 1.1 queries which retrieve:
	- ontology defined fields, including preferred label and definition 
	-
	-

	"""

	def __init__(self):

		self.graph=rdflib.Graph()

		self.struct = OrderedDict()
		# JSON-LD @context markup, and as well its used for a prefix encoding table.
		self.struct['@context'] = {		#JSON-LD markup
			'ifm':'http://purl.obolibrary.org/obo/GENEPIO/IFM#',  # Must be ordered 1st or obo usurps.
			'obo':'http://purl.obolibrary.org/obo/',
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
			'ancestro': 'http://www.ebi.ac.uk/ancestro/'
		}
		self.struct['specifications'] = {}
		self.struct['units'] = {}


	def __main__(self): #, main_ontology_file

		(options, args) = self.get_command_line()

		if options.code_version:
			print CODE_VERSION
			return CODE_VERSION

		if not len(args):
			stop_err('Please supply an OWL ontology file (in RDF format)')

		main_ontology_file = args[0] #accepts relative path with file name
		main_ontology_file = self.check_folder(main_ontology_file, "Ontology file")
		if not os.path.isfile(main_ontology_file):
			stop_err('Please check the OWL ontology file path')			

		print "PROCESSING " + main_ontology_file + " ..."
		# Load main ontology file into RDF graph
		self.graph.parse(main_ontology_file)
		# Add each ontology include file (must be in OWL RDF format)
		self.ontologyIncludes()

		#data_representational_model
		specBinding = {'root': rdflib.URIRef(self.expandId('obo:OBI_0000658'))} 
		self.doSpecifications(self.doQueryTable('tree', specBinding ))
		
		# ALSO GET OTHER TOP-LEVEL TERMS?
		# ...

		self.doSpecParts(self.doQueryTable('spec_parts' ) )	
		self.doPrimitives(self.doQueryTable('inherited') )		
		self.doPrimitives(self.doQueryTable('primitives') )
		self.doPrimitives(self.doQueryTable('categoricals') ) #SHOULD BE GOING TO picklists?
		self.doUnits(self.doQueryTable('units') )

		# Categorical tree specification
		picklistBinding = {'root': rdflib.URIRef(self.expandId('obo:GENEPIO_0001655'))}
		self.doPickLists(self.doQueryTable('tree', picklistBinding ))
		self.doPickLists(self.doQueryTable('individuals') )

		self.doUIFeatures(self.doQueryTable('features') ,'features')
		self.doUIFeatures(self.doQueryTable('feature_annotations'), 'feature_annotations')
		self.doLabels(['specifications','units'])

		# DO NOT USE sort_keys=True on piclists etc. because this overrides OrderedDict() sort order.
		# BUT NEED TO IMPLEMENT json ordereddict sorting patch.

		with (open('./ontology_ui.json','w')) as output_handle:
			output_handle.write(json.dumps(self.struct,  sort_keys=False, indent=4, separators=(',', ': ')))
	

	def doSpecifications(self, table):
		""" ####################################################################
			SPECIFICATIONS

			A specification is basically a data entity that can be transformed into a form, 
			record or report.  The 'has_value_specification' relation specifies what 
			component entities and primitive data types it has.  The specification can
			indicate the "cardinality" or restriction on the number	of occurances 
			(some, > 0, = 1, < n) of some other entity as a part.
			For example one can specify that a contact can have up to 3 phone numbers.
			Since such constraints can be very installation specific, they should be placed
			in the MODEL_import.owl file that is expected to vary between implementations.

			When an entity "is a" subclass of a specification, it means that in addition to
			all of the entity's own 'has_value_specification' attributes, it inherits those
			of its parent(s)

			In example below, a "contact specification - patient" (obo:GENEPIO_0001677) inherits 
			attributes from "contact specification - person" (obo:GENEPIO_0001606)

			CATCHES cases where a specification "is a" subclass of another specification.
			Example:
				"obo:GENEPIO_0001677": {
		            "id": "obo:GENEPIO_0001677",
		            "parent": "obo:GENEPIO_0001606",
		            "prefLabel": "contact specification - patient"
		            }
		        }
			
			MERGING WITH PICKLIST ....

		"""
		struct = 'specifications'
		for myDict in table:
			myDict['id'] = str(myDict['id'])
			myDict['datatype'] = 'specification'
			self.setDefault(self.struct, struct, myDict['id'], myDict)

			parentId = self.getParentId(myDict)

			self.setDefault(self.struct, struct, parentId, {
				'id': parentId, 
				'datatype': 'specification',
				'members': OrderedDict()
			})

			self.setStruct(self.struct, struct, parentId, 'members', myDict['id'], [])


	def doPickLists(self, table):
		""" ################################################################
			PICKLISTS 

			This is a flat list containing every picklist item.  To advance through a given
			picklist one recursively reads through a picklist node's members.
			A given term may belong to a number of piclists, e.g. "other" category.

		"""
		struct = 'specifications'
		# Fashion complete picklists (flat list) of items, with parent(s) of each item, and members.
		for myDict in table:
			id = str(myDict['id'])
			parentId = self.getParentId(myDict)
			myDict.pop('parent')
			#This picklist node might already have been mentioned in another picklist 
			# node's member list so it might already be set up.
			self.setDefault(self.struct, struct, id, myDict)
			self.setDefault(self.struct, struct, id, 'member_of', [])
			self.setDefault(self.struct, struct, id, 'datatype', 'xmls:anyURI') # MARKS PICKLIST ITEMS
			self.getStruct(self.struct, struct, id, 'member_of').append(parentId)
			# ALSO ADD 'located in' as 'part of' links?????

			# Ditto for a member
			self.setDefault(self.struct, struct, parentId, {'id': parentId} )
			self.setDefault(self.struct, struct, parentId, 'members', OrderedDict())
			self.setStruct(self.struct, struct, parentId, 'members', id, [])


	def doSpecParts(self, table):
		""" ####################################################################
			FIELD GROUPS

			This is tricky because Cardinality and limit must be transferred to parent's children list.
			A field's parent might not be in fields yet, so have to initialise it.

			INPUTS
				?parent ?id ?cardinality ?limit

		"""
		struct = 'specifications'
		for myDict in table:

			id = str(myDict['id'])
			if not isinstance(id, basestring):
				print "Field Groups problem - missing id as string:", myDict
				return

			self.setDefault(self.struct, struct, id, {'id': id} )
			self.setDefault(self.struct, struct, id, 'part_of', [] )	


			parentId = self.getParentId(myDict)
			if parentId:
		
				if parentId == id:
					print 'WARNING: an entity mistakenly "Has Part" of itself: %s ' % id
				else:

					self.setDefault(self.struct, struct, parentId, {'id': parentId, 'datatype': 'specification'} )
					self.struct[struct][id]['part_of'].append(parentId)

					obj = {'cardinality': myDict['cardinality']}
					if 'limit' in myDict: 
						obj.update(self.getBindings(myDict['limit']))

					# First time children list populated with this id's content:
					self.setDefault(self.struct, struct, parentId, 'parts', {})
					self.setDefault(self.struct, struct, parentId, 'parts', id, [])
					self.getStruct(self.struct, struct, parentId, 'parts', id).append(obj)

					# BNodes have no name but have expression stuff.
					if 'expression' in myDict: 
						# E.g. HAS LOGIC EXPRESSION:  {'expression': {'datatype': 'disjunction', 'data': [u'sio:SIO_000661', u'sio:SIO_000662', u'sio:SIO_000663']}, u'cardinality': u'owl:maxQualifiedCardinality', u'limit': {'datatype': u'xmls:nonNegativeInteger', 'value': u'1'}, u'id': rdflib.term.BNode('N65c806e2db1c4f7db8b7b434bca58f78'), u'parent': u'obo:GENEPIO_0001623'}
						print "HAS LOGIC EXPRESSION: ", myDict
						print
						expression = myDict['expression']
						self.struct[struct][id]['datatype'] = expression['datatype']
						self.struct[struct][id]['uiLabel'] = '' #
						self.struct[struct][id]['parts'] = {}
						for ptr, partId in enumerate(expression['data']):
							self.struct[struct][id]['parts'][partId] = [] # So far logical expression parts have no further info.


	def doPrimitives(self, table):
		""" ####################################################################
			PRIMITIVES
			Any field that "has primitive value spec".
			
			Sets the datatype of a field, and any range limits on primitive datums.
			Each field is allowed only one datatype.  If this routine is called a second 
			time with a different datatype it is assumed that this is a lower-level
			definition overriding an inherited one.

			The following constraints apply to the number or text of a particular datum value; they are about how many (including minimum and maximum limits) data values of a particular data type it takes - minimum sufficient criteria - to be considered an entity instance of the given ontology id.  The constraints don't necessarily reflect directly on how many items a user is actually submitting in a form or how many are held in a data store with respect to a datum that is claimed to be of the given ontology id type.  The real world of data can be incomplete - a form can be partly filled in, and returned-to later for completion.  However, these constraints can be used to VALIDATE whether an entity fulfills its overall definition.
			
			Note that all categorical pick lists inherit 'categorical measurement datum' datatype of exactly 1 xmls:anyURI .

			Some examples:
				Datum X "'has primitive value spec' exactly 1 xmls:anyURI"
				is the same as:
				Datum X "'has primitive value spec' owl:qualifiedCardinality 1 xmls:anyURI"
				These cases are typical of any datums that have 'categorical measurement datum' as an ancestor.

				Datum X "'has primitive value spec' owl:someValuesFrom xmls:anyURI"
				This case can't be an ancestor of 'categorical measurement datum' since a datum can point to only one value (or structure of values).

			To allow more than one item to be selected from a list or tree requires that the item is_a 'data representational model' that 'Has Part' [condition, e.g. > 0]   
			
			Currently sparql queries don't return a constraint property for a term that has only been marked with "has primitive value spec owl:someValuesFrom [data type]".  This default empty constraint case is currently being interpreted as
			 - If categorical selection value, it is an optional selection.
			 - If numeric or text, it is not required, but 1 field data entry is allowed.  Technically this may be challenged - it may be the default use of someValuesFrom should require at least one value entry, and perhaps more than one.

			INPUTS
				?id ?datatype 
				?constraint like constraint': u'xmls:minInclusive'
				?expression like: {'datatype': u'xmls:integer', 'value': u'0'}


			ISSUE: ANONYMOUS NODES ARE MISSING DATATYPES, LABELS, MAYBE ALL BUT FIRST NODE

		"""
		struct='specifications'
		for myDict in table:
			id = myDict['id']
			self.setDefault(self.struct, struct, id, {'id':id} )
			record = self.struct[struct][id]
			self.setDefault(record, 'datatype', myDict['datatype'])

			if record['datatype'] != myDict['datatype']:
				self.setStruct(record,'datatype', myDict['datatype'])
				self.setStruct(record,'constraints', []) #override past constraints.
				#print "ERROR for %s: multiple datatypes assigned: %s, %s" % (id, record['datatype']['type'], myDict['datatype'])

			if 'constraint' in myDict:

				obj = {'constraint': myDict['constraint']}	

				if 'expression' in myDict: 
					if isinstance(myDict['expression'], basestring):	
						obj['value'] = myDict['expression']
					else:
						obj.update(self.getBindings(myDict['expression']))

				"""
				The use of "<" and ">" lead to minExcludes and maxExcludes constraints.
				Normalize these into minIncludes and maxIncludes so less UI hassle.
				"""
				constraint = obj['constraint']
				if constraint == 'xmls:minExclusive':
					obj['constraint'] = 'xmls:minInclusive'
					obj['value'] = int(obj['value']) + 1
				elif constraint == 'xmls:maxExclusive':
					obj['constraint'] = 'xmls:maxInclusive'
					obj['value'] = int(obj['value']) - 1

				# Terms in pick lists are inheriting the 'categorical measurement datum' condition of having only 1 xmls:anyURI value.  Leave this implicit since an xmls:anyURI can't be anything else.  Catch this in the Sparql query instead?

				# Other terms A string term may also inherit "primitive value spec exactly 1 xsd:string" but this may be overridden with more specific expression constraints on how long the string is or its regex pattern content.
				# ,'xmls:date','xmls:time','xmls:dateTime','xmls:dateTimeStamp'
				elif record['datatype'] in ['xmls:anyURI'] and constraint == 'owl:qualifiedCardinality' and int(obj['value']) == 1:
					continue

				self.setDefault(record,'constraints', [])
				self.getStruct(self.struct, struct, id, 'constraints').append(obj)


	def doUnits(self, table):
		""" ####################################################################
			UNITS 
			1) Map a field to one or more allowed units.    

			2) Establish a unit lookup table (to get its label etc.) by unit id. (units don't currently have a prefLabel)

			The input table currently lists an input's unit(s) and label(s), even if they repeat.
			However this should be augmented with the entire units ontology tree so an input with a general 'time unit'
			can have access to any of the underlying units.
		"""

		for myDict in table:
			if not myDict['id'] in self.struct['specifications']:
				print "NOTE: field [%s] isn't listed in a specification, but a unit [%s] is attached to it" % (myDict['id'],myDict['unit'])
				continue
			else:
				self.setDefault(self.struct, 'specifications', myDict['id'], 'units', [])
				self.getStruct(self.struct, 'specifications', myDict['id'],'units').append(myDict['unit'])

				#Populate Units list
				self.setStruct(self.struct, 'units' ,myDict['unit'], {
					'id': myDict['unit'],
					'label': myDict['label']
				})



	def doUIFeatures(self, table, table_name):
		""" ####################################################################
			User Interface Features

			Features are placed on an entity directly as an ordered array in 'features' attribute.
			Or they are recreated on relation between a parent item and its children.

			REVISE:
			"obo:GENEPIO_0001746" is the annotation property that marks as hidden
			the relation between a part (form field or specification) and its parent.
			In the future ?criteria may	contain a user type or other expression.  
			For now, "hidden" means not	to show item in pick-lists (unless it is a 
			categorical choice in data value?) This raises the difference between 
			local disuse for a choice, vs. global possibility that it exists in data.

			The difference between "part" and "member": "member" is reserved for "is a" relationships.
			"part" is reserved for "Has Part" relations.

			Features get added onto existing parent-child member or part lists.  
			parent's list must have child already established?
			INPUT
				?id ?member ?feature ?criteria 

		"""
		#Loop through query results; each line has one id, feature, referrer.
		for myDict in table:
			id = myDict['id']
			referrer = myDict['referrer']  #Id of parent/
			feature = myDict['feature']
			# Providing plain english term for feature unless motivation to keep onto ids arises.
			if feature == 'obo:GENEPIO_0001746':
				feature = 'hidden'
			elif feature == 'obo:GENEPIO_0001763':
				feature = myDict['criteria']
			else:
				feature = 'unknown'
			myObj = {'feature': feature}
			if len(myDict['criteria']) > 0:
				myObj['criteria'] = myDict['criteria']

			# Look in parents 'members' table for features,
			# or parents 'parts' table for 'feature annotations'
			if table_name == 'features':
				myList = 'members' 
			else:
				myList = 'parts'

			if id in self.struct['specifications']:

				# if no referrer, then just mark feature directly in feature set of entity
				if referrer == '':
					entity = self.struct['specifications'][id]
					if not entity:
						print "Error,  no specification for id ", id, " when working on", table_name
					else:
						self.setDefault(entity, 'features', []) #OrderedDict()
						#self.getStruct(entity, 'features').append(myObj)
						entity['features'].append(myObj)
				else:
					# Go find referrer
					entity = self.getStruct(self.struct, 'specifications', referrer)
					if not entity:
						print "Error when adding feature: couldn't locate ", referrer
						continue

					self.setDefault(entity, myList, OrderedDict())
					self.setDefault(entity, myList, id,[])
					self.getStruct(entity, myList, id).append(myObj)	
					print "Feature added:", id, feature, myDict['criteria']		
					
					#except:
					#	print "Error when adding feature; ", id, 'in ', myTable, ', ', referrer
					#	continue


	def doLabels(self, list):
		""" ####################################################################
			For given list of entity dictionaries, augment each dictionary with onto
			term label and definition.
			ALSO lookup 
				synonyms = ?datum ?synonym ?exactSynonym ?narrowSynonym
				rdfs:DbXRefs = reference

			FUTURE: handle multi-lingual content

			INPUTS
				?label ?definition ?uiLabel ?uiDefinition
		"""

		# Add preferred label and definition for items in each table
		for table in list:
			for id in self.struct[table]:
				self.doALabel(table, id)
				uriID = rdflib.URIRef(self.expandId(id))
				dbreferences = self.graph.query(self.queries['dbreferences'], initBindings = {'datum': uriID })
				if len(dbreferences):
					dbxrefList = self.setDefault(self.struct, table, id, 'hasDbXref', [])		
					for row in dbreferences:
						dbxrefList.append(row['dbXref'])

				synonyms = self.graph.query(self.queries['synonyms'], initBindings={'datum': uriID })
				if len(synonyms):	
					for row in synonyms: #(datum, synonym, exactSynonym, narrowSynonym) 
						for field in ['Synonym','ExactSynonym','NarrowSynonym']:
							# ISSUE: Not Multilingual yet.  Can have {language: french} or {language: Scottish Gaelic} etc. at end. 
							if row[field]: 
								synonymTypeList = self.setDefault(self.struct, table, id, 'has' + field, [])
								phrases = str(row[field]).strip().replace(',','\n').split('\n')
								for phrase in phrases:
									synonymTypeList.append( phrase.strip())


	def doALabel(self, table, id):
		"""
			In order to do a sparql query to get back the label fields for an item, we have to supply
			the query with initBindings which includes the binding for [prefix]:id so query can
			succeed for that item.  
			E.g. GENEPIO:GENEPIO_12345 -> purl.obolibrary.org/obo/GENEPIO/GENEPIO_12345
		"""
		rows = self.graph.query(self.queries['labels'],	initBindings={'datum': rdflib.URIRef(self.expandId(id) ) } )
		for row in rows: # Only one row returned per idRef.
			myDict = row.asdict()	
			self.doLabel(myDict)
			self.struct[table][id].update(myDict) #Adds new text items to given id's structure


	def doLabel(self, myDict):
		""" 
			All items have and need a rdfs:Label, but this might not be what we want to display to users.
			We will however always show rdfs:Label to users on mouseover of item
			If no uiLabel, uiLabel is created as a copy of Label
			Then uiLabel always exists, and is displayed on form. "label" itself isn't needed anymore, if it is the same as uiLabel
		"""
		if not 'uiLabel' in myDict: 
			if not 'label' in myDict: # a data maintenance issue
				myDict['label'] = '[no label]'
				
			myDict['uiLabel'] = myDict['label']
		if 'label' in myDict:
			if myDict['label'] == myDict['uiLabel']: myDict.pop('label')

	############################## UTILITIES ###########################

	def getBindings(self, myDict):
		obj = {}
		for entity in myDict:
			obj[entity] = myDict[entity]

		return obj

	def getParentId(self, myDict):
		if 'parent' in myDict: 
			return str(myDict['parent']) # Sometimes binary nodes are returned
		return None

	def setStruct(self, focus,*args):
		value = args[-1]
		for ptr, arg in enumerate(args[0:-1]):
			if not arg in focus: focus[arg]={}
			if ptr == len(args)-2:
				focus[arg] = value 
			else:
				focus = focus[arg]


	def setDefault(self, focus,*args):
		""" 
			Same as setStruct() but won't create path; it will only use existing path.
		"""
		if not focus:
			print ( "ERROR: in setDefault(), no focus for setting: %s" % str(args[0:-1]) )
			return None

		value = args[-1]
		for ptr, arg in enumerate(args[0:-1]):
			#arg = str(arg) # binary nodes are objects
			if not arg: stop_err( "ERROR: in setDefault(), an argument isn't set: %s" % str(args[0:-1]) ) 
			if ptr == len(args)-2:
				if not arg in focus:
					focus[arg] = value
				return focus[arg]

			elif not arg in focus: 
				print ( "ERROR: in setDefault(), couldn't find %s" % str(args[0:-1]) )
				return False
			else:
				focus = focus[arg]

	def getStruct(self, focus, *args):
		try:
			for arg in args:
				focus = focus[arg]
		except:
			print "ERROR: in getStruct(), couldn't find '%s' key or struct in %s" % (str(arg), str(args) )
			return None
		return focus


	def extractId(self, URI):
		# If a URI has a recognized value from @context, create shortened version
		if '/' in URI or r'#' in URI: 
			(prefix, myid) = URI.rsplit('#',1) if '#' in URI else URI.rsplit(r'/',1) # Need '#' first!
			for key, value in self.struct['@context'].iteritems():
				if value[0:-1] == prefix: return key+":"+myid
			
		return URI 


	def expandId(self, URI):
		# If a URI has a recognized prefix, create full version
		if ':' in URI: 
			(prefix, myid) = URI.rsplit(':',1)
			for key, value in self.struct['@context'].iteritems():
				if key == prefix: return value+myid
			
		return URI 


	def ontologyIncludes(self):
		"""
		Detects all the import files in a loaded OWL ontology graph and adds them to the graph.
		Currently assumes imports are sitting in a folder called "imports" in parent folder of this script. 
		"""
		imports = self.graph.query("""
			SELECT distinct ?import_file
			WHERE {?s owl:imports ?import_file.}
			ORDER BY (?import_file)
		""")		

		print("It has %s import files ..." % len(imports))

		for result_row in imports: # a rdflib.query.ResultRow
			file = result_row.import_file.rsplit('/',1)[1]
			try:
				if os.path.isfile( "../imports/" + file):
					self.graph.parse("../imports/" + file)	
				else:
					print ('WARNING:' + "../imports/" + file + " could not be loaded!  Does its ontology include purl have a corresponding local file? \n")

			except rdflib.exceptions.ParserError as e:
				print (file + " needs to be in RDF OWL format!")			


	def doQueryTable(self, query_name, initBinds = {}):
		"""
		Given a sparql 1.1 query, returns a list of objects, one for each row result
		Simplifies XML/RDF URI http://... reference down to a known ontology entity code defined in 
		"""

		query = self.queries[query_name]

		try:
			result = self.graph.query(query, initBindings=initBinds) #, initBindings=initBindings
		except Exception as e:
			print ("\nSparql query [%s] parsing problem: %s \n" % (query_name, str(e) ))
			return None

		# Can't get columns by row.asdict().keys() because columns with null results won't be included in a row.
		# Handles "... SELECT DISTINCT (?something as ?somethingelse) ?this ?and ?that WHERE ....""
		#columns = re.search(r"(?mi)\s*SELECT(\s+DISTINCT)?\s+((\?\w+\s+|\(\??\w+\s+as\s+\?\w+\)\s*)+)\s*WHERE", query)
		#columns = re.findall(r"\s+\?(?P<name>\w+)\)?", columns.group(2))

		STRING_DATATYPE = rdflib.term.URIRef('http://www.w3.org/2001/XMLSchema#string')
		table = []
		for ptr, row in enumerate(result):
			rowdict = row.asdict()
			newrowdict = {}

			for column in rowdict:

				# Each value has a datatype defined by RDF Parser: URIRef, Literal, BNode
				value = rowdict[column]
				valType = type(value) 
				if valType is rdflib.term.URIRef : 
					newrowdict[column] = self.extractId(value)  # a plain string

				elif valType is rdflib.term.Literal :
					literal = {'value': value.replace('\n',r'\n')} # Text may include carriage returns; escape to json
					#_invalid_uri_chars = '<>" {}|\\^`'

					if hasattr(value, 'datatype'): #rdf:datatype
						#Convert literal back to straight string if its datatype is simply xmls:string
						if value.datatype == None or value.datatype == STRING_DATATYPE:
							literal = literal['value']
						else:
							literal['datatype'] = self.extractId(value.datatype)															

					elif hasattr(value, 'language'): # e.g.  xml:lang="en"
						#A query Literal won't have a language if its the result of str(?whatever) !
						literal['language'] = self.extractId(value.language)
					
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
					results = [self.extractId(item[0]) for item in disjunction] 
					newrowdict['expression'] = {'datatype':'disjunction','data':results}

					newrowdict[column] = value

				else:

					newrowdict[column] = {'value': 'unrecognized column [%s] type %s for value %s' % (column, type(value), value)}

			table.append(newrowdict)

		return table



	def get_command_line(self):
		"""
		*************************** Parse Command Line *****************************
		"""
		parser = MyParser(
			description = 'GenEpiO JSON field specification generator.  See https://github.com/GenEpiO/genepio',
			usage = 'jsonimo.py [ontology file path] [options]*',
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

	PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> PREFIX owl: <http://www.w3.org/2002/07/owl#>
	PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX obo: <http://purl.obolibrary.org/obo/>
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
		# Generic TREE "is a" hierarchy from given root.
		# FUTURE: ADD SORTING OPTIONS, CUSTOM ORDER.
		#
		'tree': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?parent
			WHERE {	
				?parent rdfs:subClassOf* ?root.
				?id rdfs:subClassOf ?parent.
				OPTIONAL {?id rdfs:label ?label}.
				OPTIONAL {?id obo:GENEPIO_0000006 ?uiLabel}.
			}
			ORDER BY ?parent ?label ?uiLabel
		""", initNs = namespace),

		# SECOND VERSION FOR ''
		##################################################################
		# RETRIEVE DATUM CARDINALITY, LIMIT FOR SPECIFICATION RELATIVE TO PARENT
		#
		'spec_parts': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT ?parent (?datum as ?id) ?cardinality ?limit
			WHERE { 	
				BIND (obo:RO_0002351 as ?has_member). 

				?restriction owl:onProperty ?has_member.
				?parent rdfs:subClassOf ?restriction. 

				{?restriction owl:onClass ?datum.
				?restriction (owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality) ?limit. 
				?restriction ?cardinality ?limit.}
				UNION 
				{?restriction owl:someValuesFrom ?datum.
				?restriction ?cardinality ?datum} # Returns "owl:someValuesFrom" 

				OPTIONAL {?datum rdfs:label ?label}.
			 } ORDER BY ?label

		""", initNs = namespace),

		##################################################################
		# 
		#    <owl:Class rdf:about="&obo;GENEPIO_0001627">
        #		<rdfs:label xml:lang="en">temperature of sample</rdfs:label>
        #		<rdfs:subClassOf rdf:resource="&obo;GENEPIO_0001628"/>
        #		<rdfs:subClassOf>
        #    		<owl:Restriction>
        #        		<owl:onProperty rdf:resource="&obo;GENEPIO_0001605"/>
        #        		<owl:someValuesFrom rdf:resource="&xsd;decimal"/>
        #    		</owl:Restriction>
        #		</rdfs:subClassOf>
        #		...
        #
		'primitives': rdflib.plugins.sparql.prepareQuery("""

		SELECT DISTINCT (?datum as ?id) ?datatype ?constraint ?expression
			WHERE { 	
				BIND (obo:GENEPIO_0001605 as ?hasPvaluespec).
				BIND (obo:GENEPIO_0001655 as ?categorical).
				?restriction owl:onProperty ?hasPvaluespec. 
				?datum rdfs:subClassOf ?restriction.
				
				{?restriction owl:someValuesFrom ?datatype. FILTER ( isURI(?datatype))} 
				UNION
					{?restriction owl:someValuesFrom ?datatypeObj. 
					?datatypeObj owl:onDatatype ?datatype.
					?datatypeObj owl:withRestrictions*/rdf:rest*/rdf:first ?restrictColl.
					?restrictColl ?constraint ?expression} 
				UNION # retrieve all categorical datums that are descended from a 'has primitive value spec' class. 
					{?datum rdfs:subClassOf ?categorical.
					BIND (xmls:anyURI as ?datatype)} 
				UNION # matches a single condition on 
					{?restriction owl:onDataRange ?datatype.  FILTER (! isBlank(?datatype)).
					?restriction (owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality) ?expression.
					?restriction ?constraint ?expression } 
				UNION
					{?restriction owl:onDataRange ?dataRangeObj.
					?dataRangeObj owl:onDatatype ?datatype. 
					?dataRangeObj owl:withRestrictions*/rdf:rest*/rdf:first ?restrictColl.
					?restrictColl ?constraint ?expression.
					 } 
			 } 
		""", initNs = namespace),

	
		##################################################################
		# 
		#   The difference between this and below "primitives" query is that this one 
		#	returns descendant datums.  Run inherited query first to calculate inheritances; 
		#	then run "primitives" to override inherited values with more specific ones.
		# 
		#	Handle much simpler inheritance of categoricals in 'categoricals' query below

		'inherited': rdflib.plugins.sparql.prepareQuery("""

		SELECT DISTINCT (?datum as ?id) ?datatype ?constraint ?expression
			WHERE { 	
				BIND (obo:GENEPIO_0001605 as ?hasPvaluespec).
				?restriction owl:onProperty ?hasPvaluespec. 
				?datum rdfs:subClassOf/rdfs:subClassOf+ ?restriction.

				{?restriction owl:someValuesFrom ?datatype.} 
				UNION {?restriction owl:someValuesFrom ?datatypeObj. 
					?datatypeObj owl:onDatatype ?datatype.
					?datatypeObj owl:withRestrictions*/rdf:rest*/rdf:first ?restrictColl.
					?restrictColl ?constraint ?expression.}
				UNION # matches a single condition on 
					{?restriction owl:onDataRange ?datatype.  FILTER (! isBlank(?datatype)).
					?restriction (owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality) ?expression.
					?restriction ?constraint ?expression } 
				UNION
					{?restriction owl:onDataRange ?dataRangeObj.
					?dataRangeObj owl:onDatatype ?datatype. 
					?dataRangeObj owl:withRestrictions*/rdf:rest*/rdf:first ?restrictColl.
					?restrictColl ?constraint ?expression.
					 } 
				 FILTER (?datatype != xmls:anyURI)
			 } order by ?datatype
	 """, initNs = namespace),


		##################################################################
		# CATEGORICAL FIELDS
		# One must mark an ontology term as a 'categorical tree specification'
		# in order for it to have the 'xmls:anyURI' datatype.
		# This list is dumped into the specifications tree; subordinate items
		# are placed in the picklists tree.
		#
		# These root nodes for categorical pick lists go into 'specifications' table

		'categoricals': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?datatype
			WHERE { 
				BIND (obo:GENEPIO_0001655 as ?categorical).
				BIND (xmls:anyURI as ?datatype).
				?id rdfs:subClassOf ?categorical.
			 } 
		""", initNs = namespace),

		##################################################################
		# INDIVIDUALS
		# We accept the convention that categorical picklist trees containing 
		# entities represented by proper names - like "British Columbia", 
		# "Vancouver (BC)", "Washington (DC)", etc. - may have "individual" nodes, 
		# i.e. are represented by owl:NamedIndividual.
		# 
		'individuals': rdflib.plugins.sparql.prepareQuery("""
			
			SELECT DISTINCT ?id ?parent ?datatype
			WHERE {
				BIND (obo:GENEPIO_0001655 as ?categorical_root).
				BIND (xmls:anyURI as ?datatype).
				?id rdf:type owl:NamedIndividual.
				?id rdf:type ?parent.
				?parent rdfs:subClassOfTLR*/rdfs:subClassOf+ ?categorical_root.

				#OPTIONAL {?id rdfs:subClassOfTLR ?GEO}.

			}
		""", initNs = namespace),

		##################################################################
		# ALL PRIMITIVE FIELD UNITS

		'units' :rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT (?datum as ?id)	?unit	?label ?uiLabel
			WHERE { 
				BIND (obo:GENEPIO_0001605 as ?has_primitive_value_spec). 
				BIND (obo:IAO_0000039 as ?has_measurement_unit_label).
				?datum rdfs:subClassOf* ?restriction3.
				FILTER (isIRI(?datum)).
				?restriction3 owl:onProperty ?has_measurement_unit_label.
				?restriction3 (owl:someValuesFrom | owl:withRestrictions*/owl:someValuesFrom/owl:unionOf*/rdf:rest*/rdf:first) ?unit.
				?unit rdfs:label ?label
				FILTER ( isURI(?unit))

			 } ORDER BY ?datum ?unit ?label
		""", initNs = namespace),


		# ################################################################
		# UI FEATURES
		# A picklist item or form input or specification can be hidden or required or
		# other feature with respect to its parent, via 
		# As well, a form input can have UI features indicated just by annotating it directly.
		# FUTURE: a feature may be qualified by user's user type.

		#Typical UI_hidden axioms:
		#    <owl:Axiom>
		#        <obo:GENEPIO_0001746></obo:GENEPIO_0001746>
		#        <owl:annotatedTarget rdf:resource="&obo;EO_0007027"/>
		#        <owl:annotatedSource rdf:resource="&obo;EO_0007286"/>
		#        <owl:annotatedProperty rdf:resource="&rdfs;subClassOf"/>
		#    </owl:Axiom>

	    #	<owl:Axiom>
	    #	    <obo:GENEPIO_0001746></obo:GENEPIO_0001746>
	    #	    <owl:annotatedSource rdf:resource="&obo;GENEPIO_0001740"/>
	    #	    <owl:annotatedProperty rdf:resource="&rdfs;subClassOf"/>
	    #	    <owl:annotatedTarget>
	    #	        <owl:Restriction>
	    #	            <owl:onProperty rdf:resource="&obo;RO_0002351"/>
	    #	            <owl:someValuesFrom rdf:resource="&obo;GENEPIO_0001287"/>
	    #	        </owl:Restriction>
	    #	    </owl:annotatedTarget>
	    #	</owl:Axiom>
	    #

#    <owl:Class rdf:about="http://purl.obolibrary.org/obo/GENEPIO_0001742">
#        <rdfs:subClassOf rdf:resource="http://purl.obolibrary.org/obo/GENEPIO_0001655"/>
#        <rdfs:subClassOf rdf:resource="http://purl.obolibrary.org/obo/GEO_000000005"/>
#        <obo:GENEPIO_0000006 xml:lang="en">region</obo:GENEPIO_0000006>
#        <obo:GENEPIO_0001763>lookup</obo:GENEPIO_0001763>


		'features': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?referrer ?feature ?criteria 
			WHERE { 
				{?id rdf:type owl:Class.  
					?id obo:GENEPIO_0001763 ?criteria. 
					?id ?feature ?criteria. 
					BIND ('' as ?referrer).}
				UNION
				{
				?axiom rdf:type owl:Axiom.
				?axiom owl:annotatedSource ?id.
				?axiom owl:annotatedTarget ?referrer. 
				FILTER(isURI(?referrer))
				?axiom (obo:GENEPIO_0001746|obo:GENEPIO_0001763) ?criteria.  #user interface hidden | UI_preferred feature
				?axiom ?feature ?criteria.
				}
			}
		""", initNs = namespace),


		# ################################################################
		# UI FEATURES
		# A "has member" link can be annotated with a "user interface feature"
		# Add this to list of features above.
		# FUTURE: a feature may be qualified by user's user type or identifier.
	    #
	    #    <owl:Axiom>
		#        <obo:GENEPIO_0001763>lookup</obo:GENEPIO_0001763>
		#        <owl:annotatedSource rdf:resource="&obo;OBI_0000938"/>
		#        <owl:annotatedProperty rdf:resource="&rdfs;subClassOf"/>
		#        <owl:annotatedTarget>
		#            <owl:Restriction>
		#                <owl:onProperty rdf:resource="&obo;GENEPIO_0001605"/>
		#                <owl:qualifiedCardinality rdf:datatype="&xsd;nonNegativeInteger">1</owl:qualifiedCardinality>
		#                <owl:onDataRange rdf:resource="&xsd;anyURI"/>
		#            </owl:Restriction>
		#        </owl:annotatedTarget>
		#    </owl:Axiom>

		'feature_annotations': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?referrer ?feature ?criteria 
			WHERE { 
				?axiom rdf:type owl:Axiom.
				?axiom owl:annotatedSource ?referrer.
				?axiom owl:annotatedTarget ?restriction. ?restriction rdf:type owl:Restriction.
				?restriction owl:onProperty obo:RO_0002351.
				?restriction (owl:onClass|owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality | owl:someValuesFrom) ?id
				FILTER(isURI(?id))
				?axiom (obo:GENEPIO_0001746|obo:GENEPIO_0001763) ?criteria.  #user interface hidden | UI_preferred feature
				?axiom ?feature ?criteria.
			}
		""", initNs = namespace),


		# ################################################################
		# UI LABELS 
		'labels': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT ?label ?definition ?uiLabel ?uiDefinition
			WHERE {  
				{?datum rdf:type owl:Class} UNION {?datum rdf:type owl:NamedIndividual} UNION {?datum rdf:type rdf:Description}.
				OPTIONAL {?datum rdfs:label ?label.} 
				OPTIONAL {?datum obo:IAO_0000115 ?definition.}
				OPTIONAL {?datum obo:GENEPIO_0000006 ?uiLabel.} 
				OPTIONAL {?datum obo:GENEPIO_0001745 ?uiDefinition.}
			}
		""", initNs = namespace),

		# ################################################################
		# oboInOwl:hasDbXref (an annotation property) cross references to other terminology databases 
		'dbreferences': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT ?dbXref
			WHERE {  
				{?datum rdf:type owl:Class} UNION {?datum rdf:type owl:NamedIndividual}.
				?datum oboInOwl:hasDbXref ?dbXref.
			}
		""", initNs = namespace),


		# ################################################################
		# oboInOwl:hasSynonym
		# Picklist items could be augmented with synonyms in order for 
		# type-as-you-go inputs to return appropriately filtered phrases

		'synonyms': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT ?datum ?Synonym ?ExactSynonym ?NarrowSynonym
			WHERE {  
				{?datum rdf:type owl:Class} UNION {?datum rdf:type owl:NamedIndividual}.
				{?datum oboInOwl:hasSynonym ?Synonym.} 
				UNION {?datum oboInOwl:hasExactSynonym ?ExactSynonym.}
				UNION {?datum oboInOwl:hasNarrowSynonym ?NarrowSynonym.}
			}
		""", initNs = namespace)


}

if __name__ == '__main__':

	genepio = Ontology()
	genepio.__main__()  # "../genepio.owl"

