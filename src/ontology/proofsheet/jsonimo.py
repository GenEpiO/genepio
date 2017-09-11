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
		self.struct['specifications'] = {}


	def __main__(self): #, main_ontology_file

		(options, args) = self.get_command_line()

		if options.code_version:
			print CODE_VERSION
			return CODE_VERSION

		if not len(args):
			stop_err('Please supply an OWL ontology file (in RDF format)')

		main_ontology_file = args[0] #accepts relative path with file name e.g. ../genepio-edit.owl

		main_ontology_file = self.check_folder(main_ontology_file, "Ontology file")
		if not os.path.isfile(main_ontology_file):
			stop_err('Please check the OWL ontology file path')			

		print "PROCESSING " + main_ontology_file + " ..."

		# Get ontology core filename, without .owl suffix
		ontology_filename = os.path.basename(main_ontology_file).rsplit('.',1)[0]
		
		# Get ontology version, and add to core filename
		#...

		# Load main ontology file into RDF graph
		self.graph.parse(main_ontology_file)
		# Add each ontology include file (must be in OWL RDF format)
		self.ontologyIncludes()

		# Retrieve all subclasses of data_representational_model
		specBinding = {'root': rdflib.URIRef(self.expandId('obo:OBI_0000658'))} 
		self.doSpecifications(self.doQueryTable('tree', specBinding ))
		
		# ALSO GET OTHER TOP-LEVEL TERMS?
		# ...

		self.doSpecComponents(self.doQueryTable('specification_components' ) )	
		self.doPrimitives(self.doQueryTable('inherited') )		
		self.doPrimitives(self.doQueryTable('primitives') )
		self.doPrimitives(self.doQueryTable('categoricals') )
		self.doUnits(self.doQueryTable('units') )

		# GENEPIO_0001655 = Class:Categorical tree specification
		picklistBinding = {'root': rdflib.URIRef(self.expandId('obo:GENEPIO_0001655'))}
		self.doPickLists(self.doQueryTable('tree', picklistBinding ))
		self.doPickLists(self.doQueryTable('individuals') )

		self.doUIFeatures(self.doQueryTable('features') ,'features')
		# Second call for 'member of' can override entity and 'has component' features established above.
		self.doUIFeatures(self.doQueryTable('feature_annotations'), 'feature_annotations')
		self.doLabels(['specifications']) 

		# DO NOT USE sort_keys=True on piclists etc. because this overrides OrderedDict() sort order.
		# BUT NEED TO IMPLEMENT json ordereddict sorting patch.

		with (open('./data/ontology/' + ontology_filename + '.json', 'w')) as output_handle:
			output_handle.write(json.dumps(self.struct,  sort_keys=False, indent=4, separators=(',', ': ')))


	def doSpecifications(self, table):
		""" ####################################################################
			SPECIFICATIONS

			A specification is a subClassOf 'data representational model', and is
			basically a complex entity that defines a form, record or report. 

			* The 'has_member' relation specifies what component entities it has
			  and include the cardinality restrictions on how many of a given 
			  component type are allowed (some, > 0, = 1, < n).
			* A component entity may have a "has primitive data type".  

			For example one can specify that a contact can have up to 3 phone numbers.

			When an entity "is a" subclass of a specification, it means that in addition to
			all of the entity's own 'has_value_specification' attributes, it inherits those
			of its parent(s).  WHERE TO PLACE THEM?

			In example below, a "contact specification - patient" (obo:GENEPIO_0001677) inherits 
			attributes from "contact specification - person" (obo:GENEPIO_0001606)

			Example:
				"obo:GENEPIO_0001677": {
		            "id": "obo:GENEPIO_0001677",
		            "parent": "obo:GENEPIO_0001606",
		            "prefLabel": "contact specification - patient"
		            }
		        }

		"""
		struct = 'specifications'
		for myDict in table:
			myDict['id'] = str(myDict['id'])
			myDict['datatype'] = 'model'
			self.setDefault(self.struct, struct, myDict['id'], myDict)

			parentId = self.getParentId(myDict) # primary parent according to data rep hierarchy

			self.setDefault(self.struct, struct, parentId, {
				'id': parentId, 
				'datatype': 'model',
				'models': OrderedDict()
			})

			self.setStruct(self.struct, struct, parentId, 'models', myDict['id'], [])


	def doPickLists(self, table):
		""" ################################################################
			PICKLISTS 

			This is a flat list containing every picklist item.  To advance through a given
			picklist one recursively reads through a picklist node's members.
			It is problematic for a particular picklist item to belong to several parents,
			as logically it would then inherit semantics of each parent.  However in some
			cases where no other inheritance implications are done, it is possible.

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
			self.setDefault(self.struct, struct, id, 'datatype', 'xmls:anyURI') # MARKS PICKLIST ITEMS
			self.setDefault(self.struct, struct, id, 'member_of', [])
			self.getStruct(self.struct, struct, id, 'member_of').append(parentId)
			# ALSO ADD 'located in' as 'part of' links?????

			# Ditto for parent, if any...
			self.setDefault(self.struct, struct, parentId, {'id': parentId} )
			self.setDefault(self.struct, struct, parentId, 'choices', OrderedDict())
			self.setStruct(self.struct, struct, parentId, 'choices', id, []) # empty array is set of features.


	def doSpecComponents(self, table):
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
			self.setDefault(self.struct, struct, id, 'otherParent', [] )	


			parentId = self.getParentId(myDict)
			if parentId:
		
				if parentId == id:
					print 'ERROR: an entity mistakenly is "parent" of itself: %s ' % id
				else:

					self.setDefault(self.struct, struct, parentId, {'id': parentId, 'datatype': 'model'} )
					self.struct[struct][id]['otherParent'].append(parentId)

					obj = {'cardinality': myDict['cardinality']}
					if 'limit' in myDict: 
						obj.update(self.getBindings(myDict['limit']))

					# First time children list populated with this id's content:
					self.setDefault(self.struct, struct, parentId, 'components', {})
					self.setDefault(self.struct, struct, parentId, 'components', id, [])
					self.getStruct(self.struct, struct, parentId, 'components', id).append(obj)

					# BNodes have no name but have expression stuff.
					if 'expression' in myDict: 
						# E.g. HAS LOGIC EXPRESSION:  {'expression': {'datatype': 'disjunction', 'data': [u'sio:SIO_000661', u'sio:SIO_000662', u'sio:SIO_000663']}, u'cardinality': u'owl:maxQualifiedCardinality', u'limit': {'datatype': u'xmls:nonNegativeInteger', 'value': u'1'}, u'id': rdflib.term.BNode('N65c806e2db1c4f7db8b7b434bca58f78'), u'parent': u'obo:GENEPIO_0001623'}
						print "HAS LOGIC EXPRESSION: ", myDict
						print
						expression = myDict['expression']
						self.struct[struct][id]['datatype'] = expression['datatype'] # disjunction or ???
						self.struct[struct][id]['uiLabel'] = '' #
						self.struct[struct][id]['components'] = {}
						# List off each of the disjunction items, all with a 'some'
						for ptr, partId in enumerate(expression['data']):
							self.struct[struct][id]['components'][partId] = [] # So far logical expression parts have no further info.


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
				self.getStruct(self.struct, 'specifications', myDict['id'], 'units').append(myDict['unit'])

				#Populate Units list
				self.setStruct(self.struct, 'specifications' ,myDict['unit'], {
					'id': myDict['unit'],
					'label': myDict['label']
				})


	def doUIFeatures(self, table, table_name):
		""" ####################################################################
			User Interface Features
			
			Features are (non-reasoning) annotations pertinent to display and
			data interfacing. They enable us to describe 3rd part standard field
			specifications, as well as flags for involving user interface features
			like selection list "lookup"

			In an ontology features are marked in three ways:

				1) As 'user interface feature' annotations directly on an entity.
				This is signaled in table record when no referrer id value exists.  
				These features get put in entity['features'], e.g.

				"obo:NCIT_C87194": {
					"uiLabel": "State"
            		"definition": "A constituent administrative district of a nation.",
		            "features": [
		                {
		                    "lookup":{}
		                }
		            ],...

				2) As annotations on the 'has component' parent-entity relation.
				Mainly provides cardinality, marked on parent 'components'.

				3) As annotations on the reciprocal 'member of' entity-parent
				relation. Provides overriding label, definition, and other flags
				and constraints.  Marked on parent 'components'.
			
		
			In the future ?value may contain a user type or other expression.  
			For now, "hidden" means not	to show item in pick-lists (unless it is a 
			categorical choice in data value?) This raises the difference between 
			local disuse for a choice, vs. global possibility that it exists in data.

			The difference between "part" and "member": "member" is reserved for "is a" relationships.
			"part" is reserved for "Has Part" relations.

			Features get added onto existing parent-child member or part lists. 

			parent's list must have child already established?

			INPUT
				table: ?id ?member ?feature ?value 
				table_name: 'features' or 'feature_annotations'

		"""
		#Loop through query results; each line has one id, feature, referrer.
		for myDict in table:
			id = myDict['id']
			if not id in self.struct['specifications']:
				print "Error,  no specification for id ", id, " when working on", table_name
				continue

			parent_id = myDict['referrer'] # Id of parent if applicable
			featureType = myDict['feature']

			# FEATURE MAY HAVE DATATYPE AND VALUE
			#
			#"feature": {
            #        "datatype": "http://www.w3.org/2000/01/rdf-schema#Literal",
            #        "value": "dateFormat=ISO 8601"
            #    },
			#

			valueObj = myDict['value']
			featureDict = {}

			if 'datatype' in valueObj: # ontology included a datatype in this.
				featureDict['datatype'] = valueObj['datatype']
				value = valueObj['value']

			else: # value is a straight string.
				value = valueObj 

			# User interface feature, of form [keyword] or [key:value]
			if featureType == 'obo:GENEPIO_0001763': 
				if ':' in value: #  [key:value] 
					binding = value.split(":",1)
					feature = binding[0]
					featureDict['value'] = binding[1]

					# Special case: minimize sort parameters, which are
					# a list of ontology ids, one per line, with possible
					# hashmark comment after them.
					if feature == 'order':
						orderArray = featureDict['value'].strip().strip(r'\n').split(r'\n') #splitlines() not working!
						newArray = [unicode(x.split('#')[0].strip()) for x in orderArray]
						featureDict['value'] = newArray

				else: # keyword
					feature = value

			# Other feature-value annotations picked up in 'feature_annotations' query
			else:
				featureDict['value'] = value
				if featureType == 'rdfs:label':
					feature = 'label'
				elif featureType == 'obo:IAO_0000115':
					feature = 'definition'
				elif featureType == 'obo:hasAlternativeId':
					feature = 'field_label'
				else:
					feature = featureType

			# If no parent, then just mark feature directly in entity's 
			# 'features' list.  Client side programming determines
			# what overrides what.
			if parent_id == '':
				entity = self.struct['specifications'][id]
				self.setDefault(entity, 'features', {})
				entity['features'][feature] = featureDict
				continue

			# Here entity has feature with respect to a parent, so mark in 
			# parent's entity.  Normally use "components" link but what
			# about models?
			parent = self.getStruct(self.struct, 'specifications', parent_id)
			if not parent:
				print "Error when adding feature: couldn't locate ", parent_id
				continue
				
			featureDict['feature'] = feature
			self.setDefault(parent, 'components', OrderedDict())
			self.setDefault(parent, 'components', id,[])
			self.getStruct(parent, 'components', id).append(featureDict)	


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
			All ontology items have and need a rdfs:Label, but this is often
			not nice to display to users. If no uiLabel, uiLabel is created as
			a copy of Label. Then uiLabel always exists, and is displayed on
			form. If label <> uiLabel, drop label field for efficiency's sake.

			label, definition etc. annotations on an entity 'member of' parent
			are kept in parent's 'components'.
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
		# Create a recursive dictionary path from focus ... to n-1 args, and 
		# set it to value provided in last argument
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
					literal = {'value': value.replace('\n', r'\n')} # Text may include carriage returns; escape to json
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
					newrowdict['expression'] = {'datatype':'disjunction', 'data':results}

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
		'specification_components': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT ?parent (?datum as ?id) ?cardinality ?limit
			WHERE { 	
				?restriction owl:onProperty obo:RO_0002180. # has component
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
		# As well, a form input datum can have UI features indicated just by annotating it directly.
		# FUTURE: a feature may be qualified by user's user type.
		#
		# Typical "lookup" UI feature axioms:
		#
		#    <owl:Class rdf:about="http://purl.obolibrary.org/obo/GENEPIO_0001742">
		#        <rdfs:subClassOf rdf:resource="http://purl.obolibrary.org/obo/GENEPIO_0001655"/>
		#        <rdfs:subClassOf rdf:resource="http://purl.obolibrary.org/obo/GEO_000000005"/>
		#        <obo:GENEPIO_0000006 xml:lang="en">region</obo:GENEPIO_0000006>
		#        <obo:GENEPIO_0001763>lookup</obo:GENEPIO_0001763>
		#		...
		#
	    #	<owl:Axiom>
	    #	    <obo:GENEPIO_0001763>lookup</obo:GENEPIO_0001763>
	    #	    <owl:annotatedSource rdf:resource="&obo;GENEPIO_0001740"/>
	    #	    <owl:annotatedProperty rdf:resource="&rdfs;subClassOf"/>
	    #	    <owl:annotatedTarget>
	    #	        <owl:Restriction>
	    #	            <owl:onProperty rdf:resource="&obo;RO_0002180"/>
	    #	            <owl:someValuesFrom rdf:resource="&obo;GENEPIO_0001287"/>
	    #	        </owl:Restriction>
	    #	    </owl:annotatedTarget>
	    #	</owl:Axiom>
	    #


		'features': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?referrer ?feature ?value 
			WHERE { 
				{# Get direct (Class annotated) features
					?id rdf:type owl:Class.  
					?id obo:GENEPIO_0001763 ?value.  # UI_preferred feature
					?id ?feature ?value. #
					BIND ('' as ?referrer).
				}
				UNION
				{	# Get features placed on axiom if it is a simple (subClass?) relation. 
					?axiom rdf:type owl:Axiom.
					?axiom owl:annotatedSource ?id.
					?axiom owl:annotatedTarget ?referrer. 
					FILTER(isURI(?referrer))
					?axiom obo:GENEPIO_0001763 ?value.  # UI_preferred feature
					?axiom ?feature ?value.
				}
			}
		""", initNs = namespace),

		
		# ################################################################
		# UI "MEMBER OF" STANDARD FEATURES
		#
		# A standard has datums via "has member".  Each datum in turn can have
		# a reciprocal "member of" relation to a standard.  That "member of" 
		# relation can be annotated with standard-specific label, definition, 
		# hasAlternateId and other attributes. Add all "user interface feature"
		# annotations to list of features above.
		# FUTURE: a feature may be qualified by user's user type or identifier.
		# 
	    # OLD
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

		'feature_annotations-old': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?referrer ?value 
			WHERE { 
				?axiom rdf:type owl:Axiom.
				?axiom owl:annotatedSource ?referrer.
				?axiom owl:annotatedTarget ?restriction. ?restriction rdf:type owl:Restriction.
				?restriction owl:onProperty obo:RO_0002180. # has component
				?restriction (owl:onClass|owl:qualifiedCardinality | owl:minQualifiedCardinality | owl:maxQualifiedCardinality | owl:someValuesFrom) ?id
				FILTER(isURI(?id))
				?axiom obo:GENEPIO_0001763 ?value.  # user interface feature
			}
		""", initNs = namespace),

		# USER FEATURE ANNOTATION ON DATUM - TO STANDARD?
		#	<owl:Axiom>
		#        <owl:annotatedSource rdf:resource="http://purl.obolibrary.org/obo/OBI_0000079"/>
		#        <owl:annotatedProperty rdf:resource="http://www.w3.org/2000/01/rdf-schema#subClassOf"/>
		#        <owl:annotatedTarget>
		#            <owl:Restriction>
		#                <owl:onProperty rdf:resource="http://purl.obolibrary.org/obo/RO_0002350"/>
		#                <owl:someValuesFrom rdf:resource="http://purl.obolibrary.org/obo/GENEPIO_0002085"/>
		#            </owl:Restriction>
		#        </owl:annotatedTarget>
		#        <obo:GENEPIO_0001763>lookup</obo:GENEPIO_0001763>
		#    </owl:Axiom>

		# LIST all annotations that should be treated as features below, including ""
		'feature_annotations': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?referrer ?feature ?value 
			WHERE { 
				?axiom rdf:type owl:Axiom.
				?axiom owl:annotatedSource ?id.
				?axiom owl:annotatedTarget ?restriction. ?restriction rdf:type owl:Restriction.
				?restriction owl:onProperty obo:RO_0002350. # member of
				?restriction owl:someValuesFrom ?referrer.
				FILTER(isURI(?id)).
				#user interface feature | label | definition | alternative identifier (database field)
				?axiom (obo:GENEPIO_0001763|rdfs:label|obo:IAO_0000115|obo:hasAlternativeId) ?value.  
				?axiom ?feature ?value.
			}
		""", initNs = namespace),


		# ################################################################
		# UI LABELS 
		# These are annotations directly on an entity
		'labels': rdflib.plugins.sparql.prepareQuery("""

			SELECT DISTINCT ?label ?definition ?uiLabel ?uiDefinition
			WHERE {  
				{?datum rdf:type owl:Class} 
				UNION {?datum rdf:type owl:NamedIndividual} 
				UNION {?datum rdf:type rdf:Description}.
				OPTIONAL {?datum rdfs:label ?label.} 
				OPTIONAL {?datum obo:IAO_0000115 ?definition.}
				OPTIONAL {?datum obo:GENEPIO_0000006 ?uiLabel.} 
				OPTIONAL {?datum obo:GENEPIO_0001745 ?uiDefinition.}
			}
		""", initNs = namespace),

		# ################################################################
		# STANDARDS INFORMATION
		# A "[field] 'member of' [some standard]" can have annotations of 
		# standard-specific label, definition, hasAlternateId, etc.
		# This query retrieves them; they are loaded into the parent entity's
		# corresponding members[id] dictionary
		#
		'standards_information': rdflib.plugins.sparql.prepareQuery("""
			SELECT DISTINCT ?id ?referrer ?feature ?value 
			WHERE { 
				?axiom rdf:type owl:Axiom.
				?axiom owl:annotatedSource ?id.
				?axiom owl:annotatedTarget ?restriction. ?restriction rdf:type owl:Restriction.
				?restriction owl:onProperty obo:RO_0002350. # member of
				?restriction owl:someValuesFrom ?referrer.
				FILTER(isURI(?id)).
				#Get feature as label, definition, UI label, UI definition, UI_preferred,  feature
				?axiom (rdfs:label|obo:IAO_0000115|obo:GENEPIO_0000006|obo:GENEPIO_0001745) ?value.  
				?axiom ?feature ?value.
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
		#
		# FUTURE: add oboInOwl:hasBroadSynonym ?
		#
		# INPUT
		# 	?datum : id of term to get labels for
		# OUTPUT
		#   ?Synonym ?ExactSynonym ?NarrowSynonym
		#
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

