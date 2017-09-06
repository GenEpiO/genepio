
/****************************** OntologyForm Class *********************
The OntologyForm class provides all functions needed (using jquery, Zurb 
Foundation and app.css) to render and populate an ontology-driven form.

FUTURE: MAKE USE OF BETTER TEMPLATING
WISHLIST:
	- Allow fields to take on date or dateTime formatting by providing choice
	- Allow xml datatype formats for date&time to be inherited from parent model

Author: Damion Dooley
Project: genepio.org/geem
Date: Sept 4, 2017

*/
function OntologyForm(domId, specification, settings, callback) {
	var self = this
	//bag = {}
	self.settings = {}
	self.formDomId = $(domId)
	self.specification = specification // By reference
	self.formCallback = callback

	// Some of these defaults can be overridden by particular fields via ui_feature specification
	if (settings) self.settings = settings
	if (! 'ontologyDetails' in self.settings) self.settings.ontologyDetails = false
	if (! 'minimalForm' in self.settings) self.settings.minimalForm = false


	/*********** FORM RENDERER *************************/
	this.renderEntity = function(entityId) {

		if (entityId) {
			if (entityId.indexOf('/') != -1)
				entityId = entityId.substr(0, entityId.indexOf('/'))
			self.entityId = entityId
		}
		formDelete()

		if (self.entityId) {
			
			//top.bag = {} // For catching entity in a loop.
			form_html = render(self.entityId)
			form_html += renderButton('View Mockup Form Data Submission', 'getEntityData()') 

			// Place new form html into page and activate its foundation interactivity
			self.formDomId.html(form_html) //.foundation()

			// Set up UI widget for all date inputs; using http://foundation-datepicker.peterbeno.com/example.html
			$('input[data-date-format]').fdatepicker({disableDblClickSelection: true})

			var entity = self.specification[entityId]

			// Enable page annotation by 3rd party tools by kicking browser to 
			// understand that a #anchor and page title are different.
			// MOVE THIS UP TO app.js ???
			var title = 'GEEM: ' + self.entityId
			if (entity) {
				var uiLabel = entity['uiLabel']
				title += ':' + uiLabel
				$('#panelDiscussTerm').empty().append('<h5>Term: ' + uiLabel + ' ('+self.entityId+')</h5>')
				// SET DISCUSSION FORUM IFRAME HERE
			}
			window.document.title = title

		 	// Actually load an existing data record
		 	//loadFormData()

			// Set required/optional status of fields and controls for adding more elements.
			setCardinality() 

			// Clear out specification tab.  THIS SHOULD BE DONE via form hook ON SHOW OF SPEC TAB INSTEAD.
		 	if (window.getdataSpecification) {
		 		$('#dataSpecification').empty()
		 		$("#spec_download").attr('disabled','disabled')
		 		$('#specification-tabs li.is-active').removeClass('is-active').find('a').removeAttr('aria-selected'); // how else?
		 	}

		 	if (self.settings.minimalForm) setMinimalForm() // Hides empty optional field content.

		 	// All of form's regular <select> inputs (e.g. NOT the ones for picking units)
		 	// get some extra smarts for type-as-you-go filtering.
		 	$('select.regular').each(configureSelect); 
		 	
			self.formDomId.foundation()

			//Setup of this class enables callback function to be supplied.  Could make an event instead.
			if (self.formCallback)
				self.formCallback(self)
		 }
		return false
	}


	formDelete = function() {
		if (self.formDomId)
			self.formDomId.off().empty()
	}

	setMinimalForm = function() {
		/* For all optional fields: shows label but hides the input-group part
		 of all input fields. 
		 For fields with content, marks them even if they are hidden?
		*/

		self.formDomId
			// EXPERIMENTAL Added .5 second delay to :hover state action
			.on('mouseenter', 'div.field-wrapper.optional:not(.open)', function(event) {
				domItem = $(this)
				timer = setTimeout(function () {
					event.stopPropagation();
					domItem.stop( true, true ).addClass('open')
					var inputGroup = domItem.children('div.input-group')
					inputGroup.show(100, 'linear')
				}, 500);
			})
			.on('mouseleave', 'div.field-wrapper.optional.open', function(event) {
				clearTimeout(timer);
				event.stopPropagation();
				// Keep open inputs that DO have content. Close other optional inputs
				var inputGroup = $(this).children('div.input-group')
				var someContent = inputGroup.children('input, select') // IMMEDIATE CHILDREN
					.filter(function() {return ! !this.value;}) // double negative yeilds boolean.

				if (someContent.length == 0) { // Ok to hide.
					$(this).removeClass('open')
					$(this).stop( true, true ).children('div.input-group').hide(100, 'linear')
				}
			})

			// By default, hide all optional section .input-group that has EMPTY content.
			// except if an input field is a .tabs-panel field its got another hiding system.
			.find('div:not(.tabs-panel) > div.field-wrapper.optional > div.input-group').hide()

	}

	configureSelect = function() {
		// Applies jQuery chosen()
 		var fieldWrapper = $(this).parents("div.field-wrapper").first()
 		var min = fieldWrapper.attr("min-cardinality")
		var max = fieldWrapper.attr("max-cardinality")
		var required = fieldWrapper.is('.required')
		if (required) $(this).prop('required',true); //Should do this in setCardinality() instead?
 		singleDeselect = (!min || min == 0) ? true : false

 		$(this).chosen({
 			placeholder_text_multiple: 'Select items ...',
 			placeholder_text_single: 'Select an item ...',
 			no_results_text: "Oops, nothing found!",
 			disable_search_threshold: 10,
 			max_selected_options: max,
 			allow_single_deselect: singleDeselect, //only works on single-select where first option value is ""
 			search_contains: true, //substring search
 			inherit_select_classes: true // inherits <select class=""> css
 		})

 		// But using this doesn't allow us to keep selection list open:
 		//.on('chosen:showing_dropdown',function(event) {
 		//	console.log('showing')
 		//})

 		// Other options:
 		// width: xyz pixels.
 		// max_shown_results: only show the first (n) matching options...
 		// <option selected> , <option disabled> 

 	}


	setCardinality = function() {
		/* This renders each form element's HTML required attribute via 
		javascript.	It also adds attributes for min-cardinality and 
		max-cardinality.  These are used dynamically by the form 
		processor to show user controls for adding or removing input elements.
		*/
		var cardinalityLabel = ''

		self.formDomId.find('div.field-wrapper').each(function(index) {
			var min = $(this).attr("min-cardinality") // || false
			var max = $(this).attr("max-cardinality") // || false
			var required = false

			if (min || max) {
				if (min) {
					if (max) {
						if (min == max) {
							if (min > 1) {
								cardinalityLabel = min + ' required'
								required = true
							}
							else { 
								if (min == 1) {
									cardinalityLabel = 'required'
									required = true
									console.log('got required')
								}
								else {} // 0 or less is nonsense.
							}
						}
						else {
							cardinalityLabel = 'from ' + min + ' to ' + max + ' required'
							required = true
						}
					}
					else {
						if (min == 0) 
							cardinalityLabel = 'optional' // no max
						else
							if (min > 0) {
								cardinalityLabel = min + '+ required' // some minimum was given.
								required = true
							}
						
					}
				}
				else {// No min means not required.

					if (max == 1)
						cardinalityLabel = 'optional' // no max
					else
						cardinalityLabel = '<' + (parseInt(max) + 1) + ' items'

				}

				if (required == true) {
					$(this).addClass('required')
					$(this).children('div.input-group').children('input').prop('required',true) //NOT WORKING ON INPUT
				}
				else
					$(this).addClass('optional')

				// Show optional and required status messages.
				if (self.settings.ontologyDetails && cardinalityLabel.length > 0 ) 
					$(this).children('label') //children(".fi-shopping-cart")
						.before('<span class="info label float-right">' + cardinalityLabel + '</span>')
			}
				
		})

	}


	getEntityData = function() {
		// The hierarchic form data must be converted into minimal JSON data packet for transmission back to server.
		// ISSUE: fields like temperature that have a unit field with selections. Has to be broken up. 
		var obj = {}

		$.each(self.formDomId.find("input:not(.button), select"), function(i,item) {
			var focus = obj
			var id = $(item).attr('id')
			if (id) {
				var path = id.split('/')
				for (var ptr in path) {
					var item2 = path[ptr]
					if (!(item2 in focus) ) focus[item2] = {}
					if (ptr == path.length-1) //If at end of path, make assignment
						focus[item2] = $(item).val()
					else
						focus = focus[item2]
				}
			}
		})

		setModalCode(obj, "Form data is converted into a simplified JSON data packet for submission.")

	}


	setModalCode = function (obj, header) {
		// This displays the entity json object as an indented hierarchy of text inside html <pre> tag.
		$("#modalEntity > div.row").html('<p><strong>' + header + '</strong></p>\n<pre style="white-space: pre-wrap;">' + JSON.stringify(obj, null, 2) +'</pre>\n' )
		$("#modalEntity").foundation('open') //.foundation()

	}


	/*********************** FORM SPECIFICATION BUILD **********************/
	getEntitySpecForm = function(entityId, specification = [], path = [], depth = 0, inherited = false) {
		/*
		Modelled closely on OntologyForm.render(), this returns just the form 
		specification object as it is "unwound" from pure JSON specification.
		FUTURE: Have form driven from output of this function.
		INPUT
			entityId : initial or current id to build hierarchic specification from
			specification : initially empty array containing ordered form elements.
		OUTPUT
			specification: javascript object containing all form elements.
			entity['path'] : path style indication of how far down in hierarchy
				the given entity is.
		*/
		if (entityId === false) return specification // Nothing selected yet.

		console.log("Render Form Spec ", path, entityId, depth, inherited)

		if (depth > 20) {
			console.log ("Node: ", entityId, " loop went AWOL while rendering path", path )
			return specification
		}

		if (! (entityId in self.specification)) {
			console.log("Node: " + entityId + " has no specification entry.")
			return specification
		}

		// deepcopy specification entity so we can change it.
		var entity = $.extend(true, {}, self.specification[entityId]) 
		
		if ('parent' in entity && parent['id'] == entityId) {
			console.log("Node: " + entityId + " is a parent of itself and so cannot be re-rendered.")
			return specification
		}

		if (!inherited) inherited = false // NECESSARY?

		// Initialize entity

		//entity['required'] = ''

		entity['path'] = path.concat([entityId])

		entity['depth'] = depth

		if ('features' in entity) {} else entity['features'] = {}
		getFeatures(entity)

		if (entity['depth'] > 0) {
			// When this entity is displayed within context of parent entity, that entity will 
			// indicate how many of this part are allowed.
			getCardinality(entity)
			// Currently showing "hidden" feature fields as disabled.??????????????
			entity['disabled'] = ('hidden' in entity['features']);
		}

		// Used for some controls for sub-parts
		var	label = entity['uiLabel']

		if (entity['datatype'] === undefined)
			
			console.log('No form part for: "' + entity['uiLabel'] + '" (' + entityId + ')')

		else {
			switch (entity['datatype']) {

				case 'disjunction':
					// TODO TODO TODO TODO TODO TODO TODO TODO TODO 
					//getEntitySpecDisjunction(entity, label, depth)
					break;

				case 'model':
					getEntitySpecFormParts(entity, specification, inherited, depth)
					break;

				/* PRIMITIVE data types 
				Inputs as sepecified in an OWL Ontology file can have all the standard xmls data types and restrictions.
				Potentially create ZURB Foundation fields: text, date, datetime, datetime-local, email, month, number, password, search, tel, time, url, and week
				*/

				/*
				DATE DATATYPES: date dateTime duration gDay (just DD day) gMonth (the month MM) gMonthDay	(MM-DD) gYear (YYYY) gYearMonth (YYYY-MM) time
				*/
				case 'xmls:date': //YYYY-MM-DD  and possibly time zone "Z" for UTC or +/-HH:MM
				case 'xmls:time': //HH:MM:SS and possibly .DDDD  and time zone as above.
				case 'xmls:dateTime': //YYYY-MM-DDTHH:MM:SS
				case 'xmls:dateTimeStamp': //YYYY-MM-DDTHH:MM:SS  and required time zone as above.
				case 'xmls:duration': //[-]P (period, required) + nYnMnD (years / months / days) T nHnMnS (hours / minuts / seconds)

				// Applicable restrictions : enumeration length maxLength minLength pattern whiteSpace
				case 'xmls:string':
				case 'xmls:normalizedString':
				case 'xmls:token':
					getEntitySpecFormUnits(entity)
					break;
		 
				// renderInteger(entity, minInclusive, maxInclusive)
				case 'xmls:integer':			getEntitySpecFormNumber(entity);	break
				case 'xmls:positiveInteger': 	getEntitySpecFormNumber(entity, 1);	break
				case 'xmls:nonNegativeInteger':	getEntitySpecFormNumber(entity, 0);	break
				case 'xmls:unsignedByte':		getEntitySpecFormNumber(entity, 0, 255); break// (8-bit)	
				case 'xmls:unsignedShort':		getEntitySpecFormNumber(entity, 0, 65535); break// (16-bit) 
				case 'xmls:unsignedInt':		getEntitySpecFormNumber(entity, 0, 4294967295);	break// (32-bit)		
				case 'xmls:unsignedLong':		getEntitySpecFormNumber(entity, 0, 18446744073709551615); break// (64-bit) 

				case 'xmls:negativeInteger':	getEntitySpecFormNumber(entity, null, -1); break
				case 'xmls:nonPositiveInteger':	getEntitySpecFormNumber(entity, null, 0); break

				case 'xmls:byte': 	getEntitySpecFormNumber(entity, -128, 127);	break// (signed 8-bit)
				case 'xmls:short': 	getEntitySpecFormNumber(entity, -32768, 32767);	break// (signed 16-bit)
				case 'xmls:int': 	getEntitySpecFormNumber(entity, -2147483648, 2147483647);	break// (signed 32-bit)
				case 'xmls:long': 	getEntitySpecFormNumber(entity, -9223372036854775808, 9223372036854775807); break // (signed 64-bit)

				// Decimal, double and float numbers
				case 'xmls:decimal': 
				case 'xmls:double':  
				case 'xmls:float':
					getEntitySpecFormNumber(entity)
					break;

				case 'xmls:boolean': // Yes/No inputs here
					//getEntitySpecFormBoolean(entity)
					break;

				case 'xmls:anyURI': // Picklists are here
					if (entityId in self.specification) {
						getEntitySpecFormChoices(entity)
					}
					else
						console.log('ERROR: Categorical variable [', entityId, '] not marked as a "Categorical tree specification"')
					break;

				default:
					console.log('UNRECOGNIZED: '+ entityId + ' [' + entity['datatype']  + ']' + label  )
					break;
			}

		// Various fields that flat ontology has that trimmed-down JSON or YAML form view don't need.
		entity = getEntitySimplification(entity)
		specification.push(entity)

		}

		return specification
	}

	getEntitySimplification = function(entity) {
		/* Simple view of specification dispenses with cross-references and 
		other aspects that have already been digested.
		*/
		delete (entity['parent'])
		delete (entity['otherParent'])
		//delete (entity['components'])
		delete (entity['models'])
		delete (entity['member_of'])
		delete (entity['constraints'])
		//if ($.isEmptyObject(entity['features']))
		//	delete (entity['features'])
		if ($.isEmptyObject(entity['choices']))
			delete (entity['choices'])

		// This is a CHEAT: moves uiLabel to first param in object for display purposes
		var freshEntity = {'uiLabel': entity['uiLabel']}
		return $.extend(true, freshEntity, entity) 
	}

	getEntitySpecFormParts = function(entity, topdownspecification, inherited, depth) {
		/*
		Convert given "specification" entitie's "parts" list into a list of
		processed entities.
		*/
		specification = []

		// Here we go up the hierarchy to render all inherited superclass 'has value specification' components.

		// PROBLEM 
		/* Inheritance of parent attributes & data structures.
		if ('parent' in entity) { // aka member_of or subclass of
			var parentId = entity['parent']
			if (parentId != 'obo:OBI_0000658') {//Top level spec.
				//console.log('' + depth + ": Specification "+entityId+" inheriting: " + parentId)
				this.getEntitySpecForm(parentId, specification, [], depth-1, true)
				// Do we want parent's stuff APPENDED to spec, or inserted as part of this spec?
			}
		}	
		*/

		var ids = getOrder(entity, 'components') // "has value specification" parts. 
		for (var ptr in ids) { 
			// Sort so fields within a group are consistenty orderd:
			childId = ids[ptr]
			this.getEntitySpecForm(childId, specification, entity['path'], depth+1)
		}

		// When a categorical variable is referenced on its own:
		if (inherited == false) {
			var ids = getOrder(entity, 'models') // cardinality "x has member some/one/etc y"
			for (var ptr in ids) { 
				childId = ids[ptr]
				// Cardinality lookup doesn't apply to categorical pick-lists so no need to supply path.
				this.getEntitySpecForm(childId, specification, [], depth + 1) 
			}

		entity['components'] = specification
		}
	}

	getEntitySpecFormNumber = function(entity, minInclusive=undefined, maxInclusive=undefined) {
		getEntitySpecFormConstraints(entity, minInclusive, maxInclusive)
		getEntitySpecFormUnits(entity)
	}

	getEntitySpecFormConstraints = function(entity, minInclusive=undefined, maxInclusive=undefined) {
		// This function boils down a numeric xmls min/max to 'min-value' and 'max-value' params.
		var constraints = getConstraints(entity), min, max, pattern
		if (maxInclusive === undefined || maxInclusive > constraints['xmls:maxInclusive']) 
			maxInclusive = constraints['xmls:maxInclusive']
		if (minInclusive === undefined || minInclusive < constraints['xmls:minInclusive']) 
			minInclusive = constraints['xmls:minInclusive']
		entity['min-value'] = (minInclusive === undefined) ? '' : minInclusive
		entity['max-value'] = (maxInclusive === undefined) ? '' : maxInclusive
	}

	getEntitySpecFormChoices = function(entity) {
		/* Select, radio, checkbox all get the same data structure. Here we
		know that all subordinate "hasSubClass" ~ parts are picklist choice
		items, which at most have feature annotations.
		OUTPUT
			entity.lookup if appropriate
			entity.multiple if appropriate
		*/
		if ('lookup' in entity['features']) 
			entity['lookup'] = true
		
		if (entity['min-cardinality'] > 1 || (entity['max-cardinality'] != 1))
			entity['multiple'] = true

		getEntitySpecFormChoice(entity)
	}

	getEntitySpecFormChoice = function(entity, depth = 0) { 
		/* If entity already has 'choices' option, then skip this

		OUTPUT
			part['disabled'] if appropriate.  Indicates whether a certain 
			categorical selection should be ignored or hidden.
		*/
		if (depth > 20) // NCBI Taxon might go this deep?
			console.log("MAX DEPTH PROBLEM WITH " + entity['id'])

		if ('choices' in entity) {
			var newChoices = [] // Array to preserve order
			var memberIds = getOrder(entity, 'choices') 
			for (var ptr in memberIds) {
				var memberId = memberIds[ptr]
				var part = $.extend(true, {}, self.specification[memberId]) //deepcopy
				delete part['datatype'] // Unnecessary
				if (!part) // Should never happen.
					console.log("Error: picklist choice not available: ", memberId, " for list ", entity['id'])
				else {
					// Currently showing "hidden" feature as disabled.
					if (getFeature(part, 'hidden', entity['id']) )
						part['disabled'] = true;
					var id = part['id']
					newChoices.push(getEntitySpecFormChoice(part , depth+1))
				}
			}
			entity['choices'] = newChoices
		}

		getEntitySimplification(entity)
		return entity
	}


	getEntitySpecFormUnits = function(entity) {
		// Convert units array id references into reference to unit object
		// itself.  Maintains order, and info like default unit.

		if ('units' in entity) {
			unitsArray = {}
			var units = entity['units']
			for (var ptr in units) {
				var unit = $.extend(true, {}, self.specification[units[ptr]] )
				unitsArray[unit['id']] = unit
			}
			entity['units'] = unitsArray
	   	}
	   	
	}

	/*********************** FORM PART RENDERING **********************/


	render = function(entityId, path = [], depth = 0, inherited = false, minimal = false) {
		if (entityId === false) return '' // Nothing selected yet.

		console.log("Render", path, entityId, depth, inherited)

		if (!inherited) inherited = false
		if (!minimal) minimal = false
		var html = ''

		if (depth > 20) {
			console.log ("AWOL Loop? While rendering", path )
			return html
		}
		// Prevents an item from being rendered in loop.
		// PROBLEM: Prevents >0 of an entity even when desired.e.g. phone/cell
		//if (entityId in top.bag) {console.log('ISSUE: entity '+entityId+' is in a loop');return ""} 
		//else top.bag[entityId] = true		

		// Clone entity so we can change it.
		if (entityId in self.specification)
			var entity = $.extend(true, {}, self.specification[entityId]) 
		else {
			console.log("Node: " + entityId + " has no specification entry.")
			return html
		}

		// Initialize entity
		entity['depth'] = depth
		//entity['required'] = ''
		if ('features' in entity) {} else entity['features'] = {}
		entity['path'] = path.concat([entityId])
		// Create a unique domId out of all the levels 
		entity['domId'] = entity['path'].join('/')
		if ('parent' in entity && parent['id'] == entityId) {
			console.log("Node: " + entityId + " is a parent of itself and so cannot be re-rendered.")
			return html
		}

		// Used for some controls for sub-parts
		var	label = (minimal) ? '' : renderLabel(entity)

		getFeatures(entity)

		if (entity['depth'] > 0) {
			// When this entity is displayed within context of parent entity, that entity will 
			// indicate how many of this part are allowed.
			getCardinality(entity)
			// Currently showing "hidden" feature fields as disabled.
			entity['disabled'] = ('hidden' in entity['features']) ? ' disabled="disabled"' : '';
		}

		switch (entity['datatype']) {
			case undefined: // Anonymous node
				html += renderSection(entity, label, '<span class="small"><i>No form part for this! Is it a "categorical tree specification" or does it have a "has primitive value spec" data type?</i></span>')
				break;

			case 'disjunction':
				html += renderDisjunction(entity, label, depth)
				break;

			case 'model':
				html += renderSpecification(entity, inherited, depth)
				// If specification has stuff, then wrap it:
				if (html.length > 0 && entity['uiLabel'] != '[no label]')
					return getSectionWrapper(entity, label + html)
				break;

			/* PRIMITIVE data types 
			Inputs as sepecified in an OWL Ontology file can have all the standard xmls data types and restrictions.
			Potentially create ZURB Foundation fields: text, date, datetime, datetime-local, email, month, number, password, search, tel, time, url, and week
			*/

			/*
			DATE DATATYPES: date dateTime duration gDay (just DD day) gMonth (the month MM) gMonthDay	(MM-DD) gYear (YYYY) gYearMonth (YYYY-MM) time
			*/
			case 'xmls:date': //YYYY-MM-DD  and possibly time zone "Z" for UTC or +/-HH:MM
			case 'xmls:time': //HH:MM:SS and possibly .DDDD  and time zone as above.
			case 'xmls:dateTime': //YYYY-MM-DDTHH:MM:SS
			case 'xmls:dateTimeStamp': //YYYY-MM-DDTHH:MM:SS  and required time zone as above.

			case 'xmls:duration': //[-]P (period, required) + nYnMnD (years / months / days) T nHnMnS (hours / minuts / seconds)
				html += renderDateTime(entity, label)
				break;

			// Applicable restrictions : enumeration length maxLength minLength pattern whiteSpace
			case 'xmls:string':
			case 'xmls:normalizedString':
			case 'xmls:token':
				html += renderInput(entity, label)
				break;
	 
			// renderInteger(entity, minInclusive, maxInclusive)
			case 'xmls:integer':			html += renderNumber(entity, label, 'integer');	break
			case 'xmls:positiveInteger': 	html += renderNumber(entity, label, 'integer', 1);	break
			case 'xmls:nonNegativeInteger':	html += renderNumber(entity, label, 'integer', 0);	break
			case 'xmls:unsignedByte':		html += renderNumber(entity, label, 'integer', 0, 255); break// (8-bit)	
			case 'xmls:unsignedShort':		html += renderNumber(entity, label, 'integer', 0, 65535); break// (16-bit) 
			case 'xmls:unsignedInt':		html += renderNumber(entity, label, 'integer', 0, 4294967295);	break// (32-bit)		
			case 'xmls:unsignedLong':		html += renderNumber(entity, label, 'integer', 0, 18446744073709551615); break// (64-bit) 

			case 'xmls:negativeInteger':	html += renderNumber(entity, label, 'integer', null, -1); break
			case 'xmls:nonPositiveInteger':	html += renderNumber(entity, label, 'integer', null, 0); break

			case 'xmls:byte': 	html += renderNumber(entity, label, 'integer', -128, 127);	break// (signed 8-bit)
			case 'xmls:short': 	html += renderNumber(entity, label, 'integer', -32768, 32767);	break// (signed 16-bit)
			case 'xmls:int': 	html += renderNumber(entity, label, 'integer', -2147483648, 2147483647);	break// (signed 32-bit)
			case 'xmls:long': 	html += renderNumber(entity, label, 'integer', -9223372036854775808, 9223372036854775807); break // (signed 64-bit)

			// See https://www.w3.org/TR/2005/WD-swbp-xsch-datatypes-20050427/ 
			// about XML/RDF/OWL numeric representation.
			// Re. OWL/RDF storage: Note: All "minimally conforming" processors
			// "must" support decimal numbers with a minimum of 18 decimal
			// digits (i.e., with a "totalDigits" of 18).

			case 'xmls:decimal': // max 18 digits  
				html += renderNumber(entity, label, 'decimal')
				break;

			case 'xmls:float':  
			case 'xmls:double': 
				html += renderNumber(entity, label, 'float')
				break;

			case 'xmls:boolean': // Yes/No inputs here
				html += renderBoolean(entity)
				break;

			case 'xmls:anyURI': // Picklists are here
				if (entityId in self.specification)
					html += renderChoices(entity, label)
				else
					html += '<p class="small-text">ERROR: Categorical variable [' + entityId + '] not marked as a "Categorical tree specification"</p>'
				break;

			default:
				html += renderSection(entity, label, 'UNRECOGNIZED: '+ entityId + ' [' + entity['datatype']  + ']')
				break;
		}
		return html
	}

	renderDateTime = function(entity, label) {
		/*
		Provide datepicker with ISO 8601 date/time format which can be
		overrided by other formats via entity feature "format_..."

		ISSUE: datepicker isn't compatible with html5 <input type="date">

		FUTURE: Enable date/time formats to be inheritable from parent model.
		FUTURE: Implement data-start-view="year" data-min-view="year"

		INPUT
		entity['datatype'] = xmls:date | xmls:time | xmls:dateTime | xmls:dateTimeStamp | xmls:duration
		entity['feature'] = optional "format_date=...", "format_time=..." etc.
		*/
		// Use ISO 8601 Defaults
		// But duration selection depends on given units.
		switch (entity['datatype']) {
			case 'xmls:date': format='yyyy-mm-dd'; break; //and possibly time zone "Z" for UTC or +/-HH:MM
			case 'xmls:time': format='hh:ii:SS'; break;
			case 'xmls:dateTime': format='yyyy-mm-ddThh:ii:SS'; break;
			case 'xmls:dateTimeStamp': format='yyyy-mm-ddThh:ii:SS'; break; //+ REQUIRED time zone "Z" for UTC or +/-HH:MM
			case 'xmls:duration': format=''; break; //Should be driven by units.
		}

		html = [label
			,'	<div class="input-group">\n'
			,'		<input class="input-group-field '+entity['id']+'"'
			,		' id="'+entity['domId']+'"'
			,		' type="text"'
			,		' data-date-format="' + format + '"'
			,		getPlaceholder(entity)
			,		getStringConstraints(entity)
			,		entity['disabled']
			,		'/>\n'
	    	,	renderUnits(entity)
			,	renderHelp(entity)
			,'	</div>\n'].join('')

		return getFieldWrapper(entity, html)
	}

	renderSpecification = function(entity, inherited, depth) {
		html = ''
		// Here we go up the hierarchy to render all inherited superclass 'has value specification' components.
		if ('parent' in entity) { // aka member_of or subclass of
			var parentId = entity['parent']
			if (parentId != 'obo:OBI_0000658') {//Top level spec.
				//console.log('' + depth + ": Specification "+entityId+" inheriting: " + parentId)
				html += this.render(parentId, [], depth-1, true)
			}
		}	

		// SHOULD MODELS BE MERGED WITH COMPONENTS?
		// model "subClassOf" model . 
		if (inherited == false) {
			var ids = getOrder(entity, 'models') 
			for (var ptr in ids) { 
				// Sort so fields within a group are consistenty orderd:
				childId = ids[ptr]
				html += this.render(childId, entity['path'], depth+1)
			}
		}

		// DISABLE INHERITANCE?
 		// [model|component] 'has component' [cardinality] [component|input variable]:
		var ids = getOrder(entity, 'components')
		for (var ptr in ids) { 
			// Sort so fields within a group are consistenty orderd:
			childId = ids[ptr]
			html += this.render(childId, entity['path'], depth+1)
		}

		if (inherited == false && 'choices' in entity) { //no inheritance on choices
			var ids = getOrder(entity, 'choices') // Alphabetical for now
			for (var ptr in ids) { 
				childId = ids[ptr]
				html += this.render(childId, [], depth + 1) // cardinality lookup doesn't apply to categorical pick-lists so no need to supply path.
			}
		}
		return html	
	}

	renderSection = function(entity, label, text) {
		html = [label
		,	'	<div class="input-group">\n'
		,			text
		,			renderHelp(entity)
		,	'	</div>\n'].join('')
		return getFieldWrapper(entity, html)
	}

	renderInput = function(entity, label) {
		/*
		Add case for paragraph / textarea?
		 <textarea placeholder="None"></textarea>
		*/

		html = [label
		,	'	<div class="input-group">\n'
		,	'		<input class="input-group-field '+entity['id']+'"'
		,			' id="'+entity['domId']+'"'
		, 			' type="text" '
		,			 getStringConstraints(entity)
		,			 entity['disabled']
		,			 getPlaceholder(entity)
		,			 '/>\n'
    	, 			renderUnits(entity)
		,			renderHelp(entity)
		,	'	</div>\n'].join('')
		return getFieldWrapper(entity, html)
	}


	renderButton = function(text, buttonFunction) {
		html = '<div>\n'
		html +=	'	<input type="submit" class="button float-center" value="' + text + '" onclick="'+buttonFunction+'">\n'
		html +=	'</div>\n'

		return html
	}

	renderDisjunction = function(entity, label, depth) {
		/* EXPERIMENTAL: This entity was made up of 'has value specification some X or Y or Z ... 
		Means at least one of the disjunction parts need to be included (more are allowed at moment). 
		*/
		var ids = getOrder(entity, 'components') // "has value specification" parts. 
		var domId = entity['domId']

		var htmlTabs = '<ul class="tabs" data-tabs id="' + domId + '">'
		var htmlTabContent = '<div class="input-group tabs-content" data-tabs-content="' + domId + '">'

		// Could externalize this
		for (var ptr in ids) { 
			childId = ids[ptr]
			childDomId = childId.replace(':','_')
			child = self.specification[childId]
			if (ptr == 0) {
				tab_active = ' is-active '
				aria = ' aria-selected="true" '
			}
			else {
				tab_active = ''
				aria = ''
			}

			htmlTabs += '<li class="tabs-title'+tab_active+'"><a href="#panel_'+childDomId+'" ' + aria + '>' + renderLabel(child) + '</a></li>'
			htmlTabContent += '<div class="tabs-panel'+tab_active+'" id="panel_'+childDomId+'">'

			//html += '<li class="tabs-title"><a href="#panel_'+childDomId+'">' + renderLabel(child) + '</a></li>'
			//content += '<div class="tabs-panel" id="panel_'+childDomId+'" style="padding:5px">'

			htmlTabContent += 	this.render(childId, entity['path'], depth+1, false, true )
			htmlTabContent += '</div>\n'		
		}
		htmlTabs += '</ul>' 
		htmlTabContent += '</div>\n'

		html = '<div class="field-wrapper input-tabs">' + htmlTabs + htmlTabContent + renderHelp(entity) + '</div>\n'
		html +=	'<br/>\n'
		return html
	}

	renderInput = function(entity, label) {
		/*
		Add case for paragraph / textarea?
		 <textarea placeholder="None"></textarea>
		*/

		html = [label
			,	'	<div class="input-group">\n'
			,	'		<input class="input-group-field '+entity['id']+'"'
			,			' id="'+entity['domId']+'"'
			, 			' type="text" '
			,			 getStringConstraints(entity)
			,			 entity['disabled']
			,			 getPlaceholder(entity)
			,			 '/>\n'
	    	, 			renderUnits(entity)
			,			renderHelp(entity)
			,	'	</div>\n'].join('')
		return getFieldWrapper(entity, html)
	}


	/* NUMERIC DATATYPES HANDLED HERE */
	renderNumber = function(entity, label, type, minInclusive=undefined, maxInclusive=undefined) {
		/*
		A general number input renderer that handles integer, decimal, double and float.
		Issue is that foundation zurb styles "type=number" and "type=text" inputs but 
		validation for number allows only integers by default; one has to supply a "step"
		parameter to get decimal increments.  Doing this is very awkward for data entry so
		resorting to "type=text" inputs with pattern catching the validation for those cases.

		FUTURE: implement a xsd:fractionDigits, and xsd:totalDigits
		
		INPUT: 
			type: integer|decimal|double|float

		*/
		if (type == 'integer') {
			var stepAttr = ' step="1"'
			var typeAttr = ' type="number"' // foundation zurb does css on this.
		}
		else {
			var stepAttr = ''
			var typeAttr = ' type="text"'
		}
		html = [label,
				,'<div class="input-group">\n'
		 		,'		<input class="input-group-field ' + entity['id'] + '"'
		 		,			' id="' + entity['domId'] + '"'
		 		,			typeAttr
				,			stepAttr
				,			entity['disabled']
				,			getNumericConstraints(entity, minInclusive, maxInclusive)
				,			' placeholder="' + type + '"'
				,			' pattern="' + type + '" />\n'
	    		,	renderUnits(entity)
				,	renderHelp(entity)
				,'</div>\n'
				].join('')

		return getFieldWrapper(entity, html)
	}


	renderBoolean = function(entity) {

		html =	'	<div class="switch small" style="float:left;margin-right:10px;margin-bottom:0">\n'
		html +=	'	  <input id="'+entity['domId']+'" class="switch-input" type="checkbox" name="'+entity['id']+'"' + entity['disabled'] + '/>\n' //class="switch-input '+entity['id'] + '" 
		html +=	'		<label class = "switch-paddle" for="'+entity['domId']+'"></label>\n'
		html +=	'	</div>\n'
		html +=	renderLabel(entity) 
		html +=	'	<br/>' + renderHelp(entity)
		return getFieldWrapper(entity, html)
	}

	renderChoices = function(entity, label) {
		/* FUTURE: OPTION FOR RENDERING AS SELECT OPTIONS, RADIOBUTTONS OR CHECKBOXES ...

		*/
		picklistId = entity['id']
		var multiple = entity['min-cardinality'] > 1 || (entity['max-cardinality'] != 1) ? ' multiple' : ''
		var options = renderChoice(self.specification[picklistId], 0)[0]
		var html = label
		html +=	'	<div class="input-group">\n'
		html +=	'		<select class="input-group-field '+ entity['id'] + ' regular" id="'+entity['domId']+'"' + entity['disabled'] + multiple + '>\n'
		html +=	'<option value=""></option>'  //Enables no option to be selected.

		// Because one should deliberately make a selection ... esp. when 
		// confronted with required selection list where 1st item is 
		html +=	'	<option value="" disabled>Select ...</option>'
		html +=			options
		html +=	'	</select>\n'

		if ('features' in entity && 'lookup' in entity['features']) 
			html += '		<a class="input-group-label" onclick="getChoices(this,\''+entity['id']+'\')">more choices...</a>\n'
	
		html += renderHelp(entity)
		html +=	'	</div>\n'


		return getFieldWrapper(entity, html)
	}



	renderChoice = function(entity, depth, type='select') { 
		/* 
		
		ISSUE: currently the ontologyID for each item does not include path
			   Include path, or parent?
		INPUT
			type = select|radio|checkbox
		*/

		if (depth > 10) return ('MAX DEPTH PROBLEM WITH ' + entity['id'], 0)

		var html = ''
		var memberIds = []

		if ('choices' in entity) {
			var memberIds = getOrder(entity, 'choices') 

			for (var ptr in memberIds) {
				var memberId = memberIds[ptr]
				var part = self.specification[memberId]

				if (!part) // Should never happen.
					console.log("Error: picklist choice not available: ", memberId, " for list ",entity['id'])
				else {
					// Currently showing "hidden" feature as disabled.
					var disabled = getFeature(part, 'hidden', entity['id']) ? ' disabled="disabled"' : '';
					var label = part['uiLabel']
					if (!label) {
						label = ''
						console.log['Error: picklist item has no label: ' + part['label']]
					}
					if ('label' in part && part['label'] != label)
						label = label + ' (' + part['label'] + ')'

					switch (type) {

						case "checkbox": // future
							break;
						case "radio": // future
							break;
						case "select":

						default:
							html += '<option value="' + part['id'] + '" class="depth' + depth + '" '+disabled+'>' + label + '</option>\n'  
					}
					var results = renderChoice(part, depth+1)
					if (results[1] > 0)
						html += results[0]
				}

			}
			// Wrapping kids in optgroup so we have some way of understanding depth
			//if (memberIds.length > 1 && html.length > 0)	
			//	html = '<optgroup>' + html + '</optgroup>'
		}
		
		return ['<optgroup>' + html + '</optgroup>', memberIds.length]
	}

	renderUnits = function(entity) {
		/* User is presented with choice of data-entry units if available.
		Future: enable default unit/scale (cm, mm, m, km etc.) by placing 
		default unit first in selection list.

		NOTE: server has to unparse unit associated with particular input via
		some kind of name/unit syntax.
		INPUT
			entity: 
		OUTPUT
		For a given input the id of the "units" selection list component is 
		returned with a DOM id of "[entity domId path]-obo:IAO_0000039" (unit)
		*/
		if ('units' in entity) {
			var units = entity['units']
			var label = renderLabel(self.specification[units[0]])
			if (units.length == 1) 
				return '<span class="input-group-label small">'+ label + '</span>\n'

			var html ='<div class="input-group-button" style="font-weight:700;" ><select class="units" id="'+entity['domId']+'-obo:IAO_0000039">'
			for (var ptr in units) { //.slice(1)
				var unit = self.specification[units[ptr]]
				var unitLabel = unit['uiLabel'] ? unit['uiLabel'] : unit['label']
				html += '		<option value="'+ unit['id'] + '">' + unitLabel + ' &nbsp;</option>'
			}
			html += '</select></div>\n'
			return html
	   	}
	   	return ''
	}


	renderHelp = function(entity) {
		// Currently help consists of displaying a field's user interface definition, or original ontology definition.
		var definition = ''
		if ('uiDefinition' in entity) definition = entity['uiDefinition'] 
		else if (definition in entity) definition = entity['definition']
		if (definition > '')
			return '	<p class="helper-text ' + entity['id'] + '">'+ definition+'</p>\n'
	  	return ''
	 }

	renderLabel = function(entity) {
		if (!entity) return 'ERROR: Entity not defined'

		// This links directly to form for only this entity.  Not in context of larger form.
		// Problem is that recursion to fetch parts from parent runs into parents that 
		// have no further path.
		if (self.settings.ontologyDetails && entity['depth'] > 0)
			var labelURL = '<a href="#' + entity['id'] + '">' + entity['uiLabel'] + '</a>' 
		else
			var labelURL = entity['uiLabel']

		// Enable mouseover display of above.
		html = 	['<label data-ontology-id="'+ entity['id'] +'">', 
			self.settings.ontologyDetails ? '<i class="fi-magnifying-glass"]></i>' : '',
			labelURL, 
			'</label>'
		].join('')

		return html
	}


	/************************** UTILITIES ************************/

	getPlaceholder = function(entity,type) {
		return (' placeholder="'+ entity['datatype'].substr(entity['datatype'].indexOf(':') + 1 )+ '"' ) 
	}

	getFieldWrapper = function(entity, html) {

		return ['<div class="field-wrapper field'
			,		('models' in entity || 'choices' in entity) ? ' children' : ''
			,		'" '
			,		getIdHTMLAttribute(entity['domId'])
			,		getHTMLAttribute(entity, 'min-cardinality')
			,		getHTMLAttribute(entity, 'max-cardinality')
			,		'>\n'
			,		html
			,	'</div>\n'].join('')
	}

	getSectionWrapper = function(entity, html) {
		return ['<div class="field-wrapper children" ',
			getIdHTMLAttribute(entity['domId']),
			getHTMLAttribute(entity, 'min-cardinality'),
			getHTMLAttribute(entity, 'max-cardinality'),
			'>\n',
			 html,
			 '</div>\n'].join('')
	}

	getIdHTMLAttribute = function(id) {
		return 'data-ontology-id="' + id + '" '
	}

	getHTMLAttribute = function(entity, attribute) {
		return (attribute in entity) ? attribute +'="' + entity[attribute] + '" ' : ''
	}

	getOrder = function(entity, partName) {
		/* Ordering function of an entity's model, component, or choices items
		Ordering is based on:
			
			a) if entity has entity['features']['sort'] array, comparison of 
			those values (given in ontology as 
			'user interface function'="sort: obo:ONTO_1234\n obo:ONTO_2345\n ...")
			
			b) alphabetical sort
		
		INPUT
			entity
			partName = 'models','components','choices'
		*/

		var sortArray = ('features' in entity && 'order' in entity['features']) ? entity['features']['order']['value'] : []
		var memberIds = []
		for (var memberId in entity[partName]) memberIds.push(memberId)

		return memberIds.sort(function(a,b) {
			indexA = sortArray.indexOf(a)
			indexB = sortArray.indexOf(b)
			if (indexA != -1 && indexB != -1) {
				return (indexA > indexB )
			}
			try {
				var aLabel = self.specification[a]['uiLabel'].toLowerCase()
				var bLabel = self.specification[b]['uiLabel'].toLowerCase()
			}
			catch (e) {
				//console.log("ERROR: getOrder() picklist item doesn't have a label:", a, b)
				return 0
			}

			if ( aLabel == bLabel) return 0
			return aLabel.localeCompare(bLabel) // Wierd, the ">" operator doesn't work for GEO items.

		})
	}

	getFeatures = function(entity) {
		/* 
		An instance of a form field that has entity['features'] should have those
		enhanced by parent's route to this entity.
		*/
		var referrerId = entity['path'].slice(-2)[0]
		var referrer = self.specification[referrerId]

		if (!referrer) {console.log("ERROR: can't find entity ", referrerId, " to get feature for." ); return false }
		
		var myFeatures = {}
		for (var myList in {'models':null, 'components':null}) {
			if (myList in referrer) {
				var piecesArray = referrer[myList][entity['id']]
				if (piecesArray) {
					for (var ptr in piecesArray) {
						var myobj = piecesArray[ptr]
						if ('feature' in myobj) {
							myFeatures[myobj['feature']] = $.extend({}, myobj)
						}
					}
				}
			}
		}
		// Will this OVERRIDE dictionary items?
		$.extend(entity['features'], myFeatures)

	}

	getFeature = function(entity, feature, referrerId=undefined) {
		/* A feature exists in either entity['features'] or 
		entity['components'][referrerId]

		*/

		if (referrerId) {

			var referrer = self.specification[referrerId]
			if (feature == 'order') console.log('featurehunt', referrer, entity['features'])

			if (referrer)
				for (myList in ['models', 'components']) 
					if (myList in referrer) {
						var pieceArray = referrer[myList][entity['id']]
						if (pieceArray)
							for (var ptr in pieceArray) {
								if ('feature' in pieceArray[ptr] && pieceArray[ptr]['feature'] == feature) {
									//console.log("found", feature, id, "in", entity['id']);
									return pieceArray[ptr]
								}
							}
					}
			return false
		}

		if (feature == 'order' && entity['id'] =='obo:GENEPIO_0001287') console.log('some stuff?', entity['features'])
			//Features wiped out!
		if ('features' in entity && feature in entity['features']) 
			return entity['features'][feature]

	}

	getConstraints = function(entity) {
		/* 
		Converts axiom bracketed expressions of the form:
			
			'has primitive data type' exactly 1 xsd:decimal[>= -90.0 , <= 90.0,
				 totalDigits 8, fractionDigits 6]

			'has primitive data type' exactly 1 xsd:string[length 6]

		into a dictionary with attributes corresponding to each constraint.
		Each constraints array item has "constraint", "datatype", and "value" 
		key value pairs.

		See https://books.google.ca/books?isbn=1118080602 for OWL/XML items below.

		OUTPUT
			a key-value dictionary.
		*/
		output = {}
		if ('constraints' in entity && entity['constraints'].length) {
			var constraints = entity['constraints']
			for (var ptr in constraints) {
				var constraint = constraints[ptr]['constraint']
				var value = constraints[ptr]['value']
				switch (constraint) {
					// Numeric
					case 'xmls:minInclusive':
					case 'xmls:maxInclusive':
					//case 'xmls:minExclusive': // converted into minInclusive already
					//case 'xmls:maxExclusive': // ditto.
					case 'xmls:fractionDigits':
					case 'xmls:totalDigits':

					case 'xmls:length': // exact length
					case 'xmls:minLength': 
					case 'xmls:maxLength': 
						output[constraint] = parseInt(value)
						break;

					// String
					case 'xmls:pattern': //reg. exp. for string or number.  Foundation accepts some preset expression names.
						if (value in Foundation.Abide.defaults.patterns)
							output[constraint] = value
						else
							output[constraint] = "^" + value + '$' //Match input string start to finish.
						break
					case 'xmls:whiteSpace': // preserve|collapse|replace
					case 'xmls:enumeration': //an allowed value.
						output[constraint] = value
						break;		
					default:
						break;
				}
			}
		}
		return output
	}

	getNumericConstraints = function(entity, minInclusive, maxInclusive) {
		/*

		// ISSUE: is 'pattern' getting duplicated?

		OUTPUT:
			min: min=N or empty string
			max: max=N or empty string
			pattern: xmls:pattern or empty string

		*/
		var constraints = getConstraints(entity), min, max, pattern
		if (maxInclusive === undefined || maxInclusive > constraints['xmls:maxInclusive']) 
			maxInclusive = constraints['xmls:maxInclusive']
		if (minInclusive === undefined || minInclusive < constraints['xmls:minInclusive']) 
			minInclusive = constraints['xmls:minInclusive']
		min = (minInclusive === undefined) ? '' : ' min='+minInclusive+' ' 
		max = (maxInclusive === undefined) ? '' : ' max='+maxInclusive+' ' 
		//console.log(entity['id'],max,maxInclusive, maxInclusive === undefined, constraints['xmls:maxInclusive'])
		pattern = 'xmls:pattern' in constraints ? ' pattern="' + constraints['xmls:pattern'] + '" ' : ''
		return min + max + pattern
	}

	getStringConstraints = function(entity) {
		var constraints = getConstraints(entity), min, max, pattern
		min 	= 'xmls:minLength' in constraints ? ' minLength="'+constraints['xmls:minLength']+'" ' : ''
		max 	= 'xmls:maxLength' in constraints ? ' maxLength="'+constraints['xmls:maxLength']+'" ' : ''
		//size 	= 'xmls:length' in constraints ? ' size="'+constraints['xmls:length']+'" ' : ''
		pattern = 'xmls:pattern' in constraints ? ' pattern="' + constraints['xmls:pattern'] + '" ' : ''
		return min + max + pattern
	}


	getCardinality = function(entity) {
		/* Here we're given an entity with respect to some parent entity.  The 
		parent has a cardinality qualifier relation between the two that indicates
		how	many of	that entity can exist in it's parent entity's data structure
		and by extension, on a form that comprehensively describes the given 
		entity.	This constraint also contributes to the "required" flag for the 
		given entity.

		NOTE: limits on the data range of numeric or date values is handled 
		separately in the constraints functions above.

		EXPLANATION
		In OWL/Protege it is often stated that entity A has relation B to entity C,

			e.g.: h-antigen 'has primitive value spec' some 'xsd:string'
			
		The term "some" above is equivalent to the cardinality "min 1" aka "minQualifiedCardinality 1" 
		or in plain english, "1 or more", which is ok in many logic scenarios as it
		enforces the existence of at least one example.  The cardinality of "some" in
		a user interface would on the face of it allow the user to add more than one 
		of a particular item which is fine for things like multiple phone number and 
		alternate email datums.

		However, if we're looking for one and only one datum of a certain type in an 
		entity data structure, we actually need to say that entity A has exactly 
		"owl:qualifiedCardinality 1" aka "exactly 1" of entity B, no less and no more.  

		INPUT 
			entity: the form element being rendered
			referrerId: id of parent of entity (an entity may have more than one parent)
		
		OUTPUT
			entity['min-cardinality']
			entity['max-cardinality']
			//entity['required']
		*/
		var referrerId = entity['path'].slice(-2)[0]
		var constraints = []
		var id = entity['id']
		var referrer = self.specification[referrerId]
		if ('components' in referrer) {
			// Find given entity in parent (referrer) list of parts
			for (var cptr in referrer['components'][id]) {

				// Each part will have a cardinality constraint:
				var condition = referrer['components'][id][cptr]

				// Condition's 'value' attribute indicates cardinality exact|lower|upper range.

				var limit = 'value' in condition ? parseInt(condition['value']) : 1
				switch (condition['cardinality']) {
					case 'owl:someValuesFrom': // >= 1 of ...
						entity['min-cardinality'] = 1
						break 
					case 'owl:qualifiedCardinality': // exactly N ...
						entity['min-cardinality'] = limit
						entity['max-cardinality'] = limit
						break 
					case 'owl:minQualifiedCardinality': // max N ...
						entity['min-cardinality'] = limit
						break
					case 'owl:maxQualifiedCardinality': // min N ...
						entity['max-cardinality'] = limit
						break 
					default:
				}
			}
		}
	}


	getChoices = function(helper, entityId) {
		/*
		We can set some picklists to have a dynamic lookup feature, indicated by
		a "More choices" button next to the picklist.  When this button is 
		clicked, a dynamic fetch of subordinate items to the one the user has 
		selected is performed.  A user can then select one of the given items, if
		any.  

		The picklist's selection list tree can be dynamically extended/fetched?

		CURRENTLY ONLY DOING LOOKUP ON FIRST TERM OF MULTI-SELECT
		*/
		var select = $(helper).parent('div[class="input-group"]').find("select")
		var value = select.val()
		if (value.length > 0) {
			// select.val() is either a string, for a single-select, or an array
			// for multi-select
			var term = Array.isArray(value) ? value[0] : value
			term = term.split(":")[1]
			//console.log(term)
			var ontology = term.split("_")[0]

			// https://www.ebi.ac.uk/ols/api/ontologies/doid/terms/http%253A%252F%252Fpurl.obolibrary.org%252Fobo%252FDOID_0050589/children
			// http://www.ebi.ac.uk/ols/api/ontologies/doid/terms?iri=http://purl.obolibrary.org/obo/DOID_77

			fetchURL = 'https://www.ebi.ac.uk/ols/api/ontologies/'
			fetchURL += ontology.toLowerCase()
			fetchURL += '/terms/http%253A%252F%252Fpurl.obolibrary.org%252Fobo%252F'
			fetchURL += term
			fetchURL += '/children'


			$.ajax({
				type: 'GET',
				url: fetchURL,
				timeout: 10000, //10 sec timeout
				success: function( data ) {
					msg = ''
					if ('_embedded' in data) {
						content=data._embedded.terms
						labels = []
						for (ptr in content) {
							item = content[ptr]
							//iri = item.iri
							label = item.label
							labels.push(label)
						}
						labels.sort()
						msg += labels.join('\n - ') 

						alert ('These choices (subclasses of selected term) were fetched from https://www.ebi.ac.uk/ols/:\n\n - ' + msg)
						//alert( entityId + ":" + select.val())
					}
					else 
						alert('Your choice [' + term + '] has no underlying selections')
				},
				error:function(XMLHttpRequest, textStatus, errorThrown) {alert('Dynamic Lookup is not currently available.  Either your internet connection is broken or the https://www.ebi.ac.uk/ols/ service is unavailable.')}
			})

			return false
		}
		else
			alert('Select an item, then use "more choices..." to see if there are more fine-grained choices for it.')
	}


}

// Implementing a static method for default zurb Foundation settings:
OntologyForm.initFoundation = function() {

	Foundation.Abide.defaults.live_validate = true // validate the form as you go
	Foundation.Abide.defaults.validate_on_blur = true // validate whenever you focus/blur on an input field
	focus_on_invalid : true, // automatically bring the focus to an invalid input field
	Foundation.Abide.defaults.error_labels = true, // labels with a for="inputId" will recieve an `error` class
	// the amount of time Abide will take before it validates the form (in ms). 
	// smaller time will result in faster validation
	Foundation.Abide.defaults.timeout = 1000
	Foundation.Abide.defaults.patterns = {
		alpha: /^[a-zA-Z]+$/,
		alpha_numeric : /^[a-zA-Z0-9]+$/,
		integer: /^[-+]?\d+$/,
		number: /^[-+]?[1-9]\d*$/,
		decimal: /^[-+]?[1-9]\d*.\d+$/,
		float: /^[-+]?[1-9]\d*.\d+$/,

		// http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#valid-e-mail-address
		email : /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

		url: /(https?|ftp|file|ssh):\/\/(((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?/,
		// abc.de
		domain: /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/,

		datetime: /([0-2][0-9]{3})\-([0-1][0-9])\-([0-3][0-9])T([0-5][0-9])\:([0-5][0-9])\:([0-5][0-9])(Z|([\-\+]([0-1][0-9])\:00))/,
		// YYYY-MM-DD
		date: /(?:19|20)[0-9]{2}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1[0-9]|2[0-9])|(?:(?!02)(?:0[1-9]|1[0-2])-(?:30))|(?:(?:0[13578]|1[02])-31))/,
		// HH:MM:SS
		time : /(0[0-9]|1[0-9]|2[0-3])(:[0-5][0-9]){2}/,
		dateISO: /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
	      // MM/DD/YYYY
	    month_day_year : /(0[1-9]|1[012])[- \/.](0[1-9]|[12][0-9]|3[01])[- \/.](19|20)\d\d/,
	}
}

