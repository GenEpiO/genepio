/********************** Ontology Proof Sheet Prototype ************************

	This script mainly renders a menu of ontology entities, and a form viewer
	that focuses on a selected entity.

	Author: Damion Dooley
	Project: GenEpiO.org Genomic Epidemiology Ontology
	Updated: May 28, 2017

	Note: we can get a dynamic list of OBOFoundry ontologies via: 
	http://sparql.hegroup.org/sparql?default-graph-uri=&query=SELECT+%3Fv+WHERE+%7B%3Fx+owl%3AversionIRI+%3Fv%7D&format=json   //&timeout=0&debug=on

*/

/*********** ALL THE SETUP ***************************************************/

data = {}
bag = {}
formatD = 'yyyy-mm-dd'
formatT = 'Thh:ii:SS'
shoppingCart=[]
shoppingCartOff=[]
searchDB = ''
ontologyDetails = false
top.focusEntityId = null

/*********** ACTION ***********************************************************
	This loads the json user interface oriented version of an ontology
	After ajax load of ontology_ui.json, top.data contains:
	{
		@context
		specifications
		units
		picklists
	}
*/

$( document ).ready(function() {

	initFoundation()

	$.getJSON('ontology_ui.json', function( data ) {
		// Setup Zurb Foundation user interface and form validation
		top.data = data;
		// Default entity to render:
		top.focusEntityId = null

		// This control toggles the visibility of ontology ID's in the given 
		// form content (for reference during content review)
		$('input#toggleIdVisibility').on('change', function() {
			top.ontologyDetails = $(this).is(':checked')
			renderEntity(top.focusEntityId)
		})

		// Show Data Representation Model item menu
		$("ul#entityMenu").html(renderMenu('obo:OBI_0000658'))

		// Provide type-as-you-go searching
		$("#searchField").on('keyup', searchAsYouType)

		$('ul#entityMenu *').on('click', function(event) { 
			// Enables eye icon click to show form without opening/closing the accordion.
  			event.stopPropagation();
  			if ($(event.target).is('i.fi-eye') ) {renderEntity(getEntityId(event.target))}
		});


		$("#mainForm").on('click', "i.fi-shopping-cart", function(){
			// Check and update shopping cart include/exclude status of this item
			event.stopPropagation(); // otherwise parent cart items catch same click
			cartCheck(getEntityId(this))
		})

		$("#shoppingCart")
			.on("click", 'div.cart-item', function(event) {
				event.stopPropagation(); // otherwise parent cart items catch same click
				if ($(event.target).is('i.fi-shopping-cart'))
					// Change state of shopping cart item
					cartCheck(this.dataset.ontologyId)
				else
					// Follow link if user didn't click
					renderEntity(this.dataset.ontologyId)
			})

		$("#shoppingCartTrash").on('click', function() {
			top.shoppingCart=[]
			top.shoppingCartOff=[]
			$('form#mainForm div[data-ontology-id]').removeClass('include exclude')
			$('#shoppingCart').empty()
		})

		$(document).foundation()

		$(window).on('hashchange',function(){ 
			// GEEM focuses on entities by way of a URL with hash #[entityId]
		    if (location.hash.length > 0)
			   	if (location.hash.substr(0,5) =='#obo:') {
					top.focusEntityId = document.location.hash.substr(1)
					renderEntity(top.focusEntityId)
				}
		});

		//Trying to prime menu with given item
		//$('#sidebar > ul').foundation('down', $('#obo:OBI_0001741') ) ; //Doesn't work?!
	});
});

function getEntityId(item) {
	return $(item).parents('.cart-item,.field-wrapper').first()[0].dataset.ontologyId
}


function searchAsYouType() {
	var text = $("#searchField").val()
	$("#searchResults").empty()
	if (text.length > 2) {
		var ontology_ids = filterIt(top.data.specifications, text)
		for (id in ontology_ids) {
			$("#searchResults").append(renderCartItem (ontology_ids[id]))
		}
		
		// Picklist items are currently in a separate list.
		var ontology_ids = filterIt(top.data.picklists, text) 
		if (ontology_ids.length > 0)
			$("#searchResults").append('<hr/><strong>Picklist Items</strong><br/>')
		for (id in ontology_ids) {
			$("#searchResults").append(renderCartItem (ontology_ids[id]))
		}

	}
}

function filterIt(obj, searchKey) {
	/* Text Search of ontology contents via JSON specification.
	This looks at each "specification" entry's main fields: label, uiLabel, definition, 
	uiDefinition, hasSynonym, hasNarrowSynonym, hasExactSynonym.
	 */

    return Object.keys(obj).filter(function(key) { // key is specification ontology id.
      return Object.keys(obj[key]).some(function(key2) {
      	if (typeof obj[key][key2] === "object")
      		return false
      	else
      		// FUTURE: add wildcard searching?
      		return obj[key][key2].toLowerCase().includes(searchKey.toLowerCase());
      })
    })
}


/*********** ENTITY SHOPPING CART *************************/
function cartCheck(ontologyId) {
	/* A user can select as many entities as they like, but may find that 
	some components of some entities are undesirable.  This script enables
	the shopping list to be maintained with the ability to select entities,
	and also select underlying entities or fields to omit.
	*/
	// Clear out initial help message:	
	if ($('#shoppingCart div.cart-item').length == 0)
		$("#panelCart > div.infoBox").remove()

	var dataId = '[' + getIdHTMLAttribute(ontologyId) +']'
	var items = $('div.cart-item' + dataId + ',div.field-wrapper' + dataId)
	var formItem = $('#mainForm div.field-wrapper' + dataId)
	var cartItem = $('#shoppingCart div.cart-item' + dataId)

	if (cartItem.length == 0) {
		// ADD item to shopping list; couldn't possibly have clicked on it there.

		// Place this new item under parent in cart if it exists
		var path = ontologyId.substr(0, ontologyId.lastIndexOf('/'))
		while (path.length) {
			var item = $('#shoppingCart div.cart-item[data-ontology-id="' + path+ '"]')
			if (item.length) {
				$(item).append(renderCartItem(ontologyId))
				break;
			}
			path = path.substr(0, path.lastIndexOf('/'))
		}

		if (path == '') {// item parent wasn't found
			$("#shoppingCart").prepend(renderCartItem(ontologyId))
			// Issue is that some of remaining items might be positioned under top-level
		}
		var cartItem = $('#shoppingCart div.cart-item' + dataId)
		items = items.add(cartItem)  // x.add() is immutable.

		// See if any existing items (longer ids) fit UNDER  new item
		$('#shoppingCart div.cart-item').each(function(index) {
			var id = $(this).attr('data-ontology-id')
			if (id != ontologyId) {
				if (id.substr(0, ontologyId.length) == ontologyId) 
					$(cartItem).append(this)
			}
		})

	}

	if (formItem.length == 0) {//User has displayed a different form than shoppingList selection pertains to.
		if (cartItem.is('.include'))
			cartItem.removeClass('include').addClass('exclude')
		else if (cartItem.is('.exclude'))
			cartItem.remove()
		return
	}

	// AN ITEM has a state or INHERITS STATE OF ITS FIRST STATED ANCESTOR.
	if (! formItem.is('.exclude, .include')) {
		formItem = formItem.parents('.exclude, .include').first()
		if (formItem.length == 0) {// then this is truly unselected.
			items.addClass('include')
			itemAnimate('#shoppingCartIcon', 'attention')
			return
		}
	}
	if (formItem.is('.exclude')) {
		// Item on exclusion list, so drop it entirely
		items.removeClass('exclude')
		// And remove all markings on subordinate items
		var mainFormEntity = ('#mainForm div.field-wrapper' + dataId)
		mainFormEntity.add(mainFormEntity.find('div.field-wrapper')).removeClass('include, exclude')
		cartItem.remove()
	}
	else if (formItem.is('.include')) {
		// ITEM already in shopping list so downgrade to "exclude" list.
		items.removeClass('include').addClass('exclude')
		itemAnimate('#shoppingCartIcon', 'attention')
	}
}

function itemAnimate(item, effectClass) {
	// Apply given css effectClass to given DOM item for 1 second
	$(item).addClass(effectClass)
	setTimeout('$("'+item+'").removeClass("'+effectClass+'")', 1000)
}

function renderCartItem(ontologyId) {
	var ptr = ontologyId.lastIndexOf('/')
	// Get last path item id.
	var entityId = ptr ? ontologyId.substr(ptr+1) : ontologyId
	var entity = top.data['specifications'][entityId]
	if (!entity) entity = top.data['picklists'][entityId]
	if (entity) var label = entity['uiLabel']
	else var label = '[UNRECOGNIZED]'
	return ['<div class="cart-item" ', getIdHTMLAttribute(ontologyId), '>',
		'<i class="fi-shopping-cart"></i>','<a href="#', ontologyId, '">', label , '</a></div>'].join('')
}


function setShoppingCart() {
	// UPDATE SHOPPING CART STATUS in renderEntity()
	$('#mainForm div.field-wrapper').prepend('<i class="fi-shopping-cart"></i>')
	$('#shoppingCart div.cart-item').each(function(index){
		var status = ''
		if ($(this).is('.include')) status = 'include'
		if ($(this).is('.exclude')) status = 'exclude'

		$('#mainForm div.field-wrapper[' + getIdHTMLAttribute($(this)[0].dataset.ontologyId) + ']').addClass(status)
	})
}


/*********** ENTITY MENU RENDERER *************************/
function renderMenu(entityId, depth = 0 ) {
	// WHEN THIS IS CALLED, ACTIVATE ITS TAB

	var html = ""
	var entity = top.data['specifications'][entityId]
	if (entity) {
		if ('parent' in entity && parent['id'] == entityId) {
			console.log("Node: " + entityId + " is a parent of itself and so is not re-rendered.")
			return html
		}

		var hasChildren = ('members' in entity)
		if (depth > 0) 

			html = ['<li class="cart-item" data-ontology-id="',	entityId,'">',
			hasChildren ? '<a href="#">' : '<a href="#'+entityId+'">',
			entity['uiLabel'],
			hasChildren ? ' <i class="fi-eye"></i>' : '',
			'</a>'].join('')

		// See if entity has subordinate parts that need rendering:
		if (hasChildren) {
			for (var memberId in entity['members']) {
				// Top level menu items
				if (depth == 0) html += renderMenu(memberId, depth + 1)
				// Deeper menu items
				else html += '<ul class="menu vertical nested">' + renderMenu(memberId, depth + 1) + '</ul>'	//id="'+memberId+'"
			}
		}

		html +=	'</li>'
	}
	return html
}

/*********** FORM RENDERER *************************/
function renderEntity(entityId) {

	// WHEN THIS IS CALLED, ACTIVATE ITS TAB
	$('#content-tabs').foundation('selectTab', '#content'); 
	
	top.focusEntityId = entityId;
	if (entityId.indexOf('/') != -1)
		entityId = entityId.substr(0, entityId.indexOf('/'))

	$("#mainForm").empty().html('')

	//top.bag = {} // For catching entity in a loop.
	form_html = 	render(entityId)
	form_html += 	renderButton('View Mockup Form Data Submission', 'getEntityData()') 

	// Place new form html into page and activate its foundation interactivity
	$("#mainForm").html(form_html).foundation()

	// Set up UI widget for all date inputs; using http://foundation-datepicker.peterbeno.com/example.html
	$('input[placeholder="date"]').fdatepicker({format: formatD, disableDblClickSelection: true});
	$('input[placeholder="dateTime"]').fdatepicker({format: formatD+formatT, disableDblClickSelection: true});
	$('input[placeholder="dateTimeStamp"]').fdatepicker({format: formatD+formatT, disableDblClickSelection: true});

	setShoppingCart()
	setCardinality()

	var entity = top.data['specifications'][entityId]
	if (!entity) entity = top.data['picklists'][entityId]

	// Enable page annotation by 3rd party tools by kicking browser to 
	// understand that a #anchor and page title are different.
	var title = 'GEEM: ' + entityId
	if (entity) {
		var uiLabel = entity['uiLabel']
		title += ':' + uiLabel
		$('#panelDiscussTerm').empty().append('<h5>Term: ' + uiLabel + ' ('+entityId+')</h5>')
		// SET DISCUSSION FORUM IFRAME HERE
	}
	window.document.title = title

 	getdataSpecification(entityId) // Fill specification tab
	return false
}

function setCardinality() {
	var cardinalityLabel = ''

	$('#mainForm div.field-wrapper').each(function(index) {
		var min = $(this).attr("cardinality-min") // || false
		var max = $(this).attr("cardinality-max") // || false
		//if ()
		if (min)
			if (max)
				if (min == max)
					if (min > 1) cardinalityLabel =  min + ' required'
					else cardinalityLabel = 'required'
				else
					cardinalityLabel = min + ' &lte; ' + max
			else if (min == 0) cardinalityLabel = 'optional'
			else cardinalityLabel = 'gte;' + min + ' required'
		else if (max)
			{}
		if (top.ontologyDetails && cardinalityLabel)
			$(this).prepend('<span class="info label float-right">' + cardinalityLabel + '</span>')

		//label = '<i class="fi-plus float-right"></i> <i class="fi-minus float-right"></i>' + label
	})
	/*

			case 'owl:someValuesFrom': // >= 1 of ...
				entity['cardinalityLabel'] = '1+ required'; 
				entity['cardinality-min'] = 1
				entity['required'] = ' required '
				break 
			case 'owl:qualifiedCardinality': // exactly ...
				entity['cardinalityLabel'] = (limit == 1) ? 'required' : limit + ' required'; 
				entity['cardinality-min'] = limit
				entity['cardinality-max'] = limit
				entity['required'] = ' required '
				break 
			case 'owl:minQualifiedCardinality': // at least ...
				entity['cardinalityLabel'] = limit + '+ ' + (limit == 0 ? 'optional' : 'required'); 
				entity['cardinality-min'] = limit
				if (limit != 0) entity['required'] = ' required '
				break
			case 'owl:maxQualifiedCardinality': // at most ...
				entity['cardinalityLabel'] = (limit == 1) ? 'optional' : limit + ' optional'; 
				entity['cardinality-max'] = limit
				break 
			default:
		}
	*/
			/*
			if (entity['cardinality'] == 'min')
				// SHOW CREATE ON 1st [0] ITEM UNTIL THERE ARE TOO MANY.
				if (place <= entity['cardinality-min'])
					label = '<i class="fi-plus float-right"></i>' + label
				if (place >= entity['cardinality-max'])
					label = '<i class="fi-trash float-right"></i>' + label
			*/




}


function getEntityData() {
	// The hierarchic form data must be converted into minimal JSON data packet for transmission back to server.
	// ISSUE: fields like temperature that have a unit field with selections. Has to be broken up. 
	var obj = {}

	$.each($("form").find("input:not(.button), select"), function(i,item) {
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

function getdataSpecification(entityId) {
	/* The entity form is defined by 1 encompassing entity and its parts which are 
	defined in top.data components: specification, picklists and units 
	*/
	$("#helpDataSpecification").remove()
	$("#dataSpecification").html(JSON.stringify(getEntitySpec(null, entityId), null, 2))
}


function setModalCode(obj, header) {
	// This displays the entity json object as an indented hierarchy of text inside html <pre> tag.
	$("#modalEntity >div.row").html('<p><strong>' + header + '</strong></p>\n<pre style="white-space: pre-wrap;">' + JSON.stringify(obj, null, 2) +'</pre>\n' )
	$("#modalEntity").foundation('open') //.foundation()

}

function getEntitySpec(spec, entityId = null, inherited = false) {
	if (spec == null)
		spec = {'specifications':{}, 'picklists':{}, 'units':{} }

	// A spec entity may also be a root element in picklist
	// FUTURE: MAY WANT TO MERGE THESE?
	if (entityId in top.data['picklists'] && inherited == false) {
		var picklistSpec = top.data['picklists'][entityId]
		spec['picklists'][entityId] = picklistSpec
		getEntitySpecItems(spec, picklistSpec, 'members', 'picklists')
	}

	if (entityId in top.data['specifications']) {
		var entity = top.data['specifications'][entityId]
		if (entity) {
			spec['specifications'][entityId] = entity
			
			if (inherited == true) {
				//Entity inherits 'part_of' ancestors' parts. 
				var parentId = entity['parent']
				if (parentId != 'obo:OBI_0000658') //Top level spec.
					getEntitySpec(spec, parentId, true)
			}

			getEntitySpecItems(spec, entity, 'parts', 'specifications')
			getEntitySpecItems(spec, entity, 'units', 'units')
		}
	}

	return spec
}

function getEntitySpecItems(spec, entity, type, table, inherited = false) {
	if (type in entity) {
		if (table == 'units') //WHY?
			for (var ptr in entity[type]) {
				var partId = entity[type][ptr]
				spec[table][partId] = top.data[table][partId]
				getEntitySpec(spec, partId)
			}
		else
			for (var partId in entity[type]) {
				spec[table][partId] = top.data[table][partId]
				getEntitySpec(spec, partId)
			}
	}
}

/*********************** FORM PART RENDERING **********************/


function render(entityId, path = [], depth = 0, inherited = false, minimal = false) {
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
	if (entityId in top.data['specifications'])
		var entity = $.extend(true, {}, top.data['specifications'][entityId]) 
	else if (entityId in top.data['picklists']) {
		var entity = $.extend(true, {}, top.data['picklists'][entityId]) 
		entity['datatype'] = 'xmls:anyURI' 
		// ADD FEATURE TO SELECT SUBORDINATE ITEMS?
	}
	else {
		console.log("Node: " + entityId + " has no specification entry.")
		return html
	}

	// Initialize entity
	entity['required'] = ''
	entity['features'] = {}
	entity['path'] = path.concat([entityId])
	// Create a unique domId out of all the levels 
	entity['domId'] = entity['path'].join('/')
	if ('parent' in entity && parent['id'] == entityId) {
		console.log("Node: " + entityId + " is a parent of itself and so cannot be re-rendered.")
		return html
	}

	// Used for some controls for sub-parts
	var	label = (minimal) ? '' : renderLabel(entity)

	if (entity['path'].length > 1) {
		// When this is a member of another entity, that entity will 
		// indicate how many of this part are allowed.
		getFeatures(entity)
		getCardinality(entity)
		// Currently showing "hidden" feature fields as disabled.
		entity['disabled'] = ('hidden' in entity['features']) ? ' disabled="disabled"' : '';
	}

	switch (entity['datatype']) {
		case undefined: // Anonymous node
			html += renderSection('<strong>Error: No datatype for ' + entityId + '(' + renderLabel(entity) + ') !</strong><ul><li>Hint: A picklist must be a subclass of "categorical tree specification".</li><li>Other fields need a "has primitive value spec" data type.</li><li>or was this in an include file that failed to load?</li></ul>')
			break;

		case 'disjunction':
			html += renderDisjunction(entity, label, depth)
			break;

		case 'specification':
			html += renderSpecification(entity, inherited, depth)
			if (html.length > 0 && entity['uiLabel'] != '[no label]')
				html = ['<div class="field-wrapper children', entity['required'], '" data-ontology-id="', entity['domId'], '">\n', 
					label, html, '\n</div>'].join('')
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
			html += renderInput(entity, label)
			break;
 
		// renderInteger(entity, minInclusive, maxInclusive)
		case 'xmls:integer':			html += renderInteger(entity, label);	break
		case 'xmls:positiveInteger': 	html += renderInteger(entity, label, 1);	break
		case 'xmls:nonNegativeInteger':	html += renderInteger(entity, label, 0);	break
		case 'xmls:unsignedByte':		html += renderInteger(entity, label, 0, 255); break// (8-bit)	
		case 'xmls:unsignedShort':		html += renderInteger(entity, label, 0, 65535); break// (16-bit) 
		case 'xmls:unsignedInt':		html += renderInteger(entity, label, 0, 4294967295);	break// (32-bit)		
		case 'xmls:unsignedLong':		html += renderInteger(entity, label, 0, 18446744073709551615); break// (64-bit) 

		case 'xmls:negativeInteger':	html += renderInteger(entity, label, null, -1); break
		case 'xmls:nonPositiveInteger':	html += renderInteger(entity, label, null, 0); break

		case 'xmls:byte': 	html += renderInteger(entity, label, -128, 127);	break// (signed 8-bit)
		case 'xmls:short': 	html += renderInteger(entity, label, -32768, 32767);	break// (signed 16-bit)
		case 'xmls:int': 	html += renderInteger(entity, label, -2147483648, 2147483647);	break// (signed 32-bit)
		case 'xmls:long': 	html += renderInteger(entity, label, -9223372036854775808, 9223372036854775807); break // (signed 64-bit)

		case 'xmls:decimal': // max 18 digits
		case 'xmls:float':
			html += renderNumber(entity, label)
			break;

		case 'xmls:boolean': // Yes/No inputs here
			html += renderBoolean(entity)
			break;

		case 'xmls:anyURI': // Picklists are here
			if (entityId in top.data['picklists'])
				html += renderChoices(entity, label)
			else
				html += '<p class="small-text">ERROR: Categorical variable [' + entityId + '] not marked as a "Categorical tree specification"</p>'
			break;

		default:
			html += renderSection('UNRECOGNIZED: '+ entityId + ' [' + entity['datatype']  + ']' + label  )
			break;
	}
	return html
}

function renderSpecification(entity, inherited, depth) {
	html = ''
	// Here we go up the hierarchy to render all inherited superclass 'has value specification' components.
	if ('parent' in entity) { // aka member_of or subclass of
		var parentId = entity['parent']
		if (parentId != 'obo:OBI_0000658') {//Top level spec.
			//console.log('' + depth + ": Specification "+entityId+" inheriting: " + parentId)
			html += render(parentId, [], depth-1, true)
		}
	}	

	var ids = getSort(entity['parts'], 'specifications') // "has value specification" parts. 
	for (var ptr in ids) { 
		// Sort so fields within a group are consistenty orderd:
		childId = ids[ptr]
		html += render(childId, entity['path'], depth+1)
	}

	if (inherited == false) {
		var ids = getSort(entity['members'], 'specifications') //'is a' members, e.g. categorical lists or trees
		for (var ptr in ids) { 
			childId = ids[ptr]
			html += render(childId, [], depth + 1) // cardinality lookup doesn't apply to categorical pick-lists so no need to supply path.
		}
	}
	return html	
}

function renderSection(text) {
	html = '<div>\n'
	html +=	'	<label>' + text + '</label>\n'
	html +=	'</div>\n'

	return html
}


function renderButton(text, buttonFunction) {
	html = '<div>\n'
	html +=	'	<input type="submit" class="button float-center" value="' + text + '" onclick="'+buttonFunction+'">\n'
	html +=	'</div>\n'

	return html
}

function renderDisjunction(entity, label, depth) {
	/* This entity was made up of 'has value specification some X or Y or Z ... 
	Means at least one of the disjunction parts need to be included (more are allowed at moment). 
	*/
	var ids = getSort(entity['parts'], 'specifications') // "has value specification" parts. 

	var html = '<div>' + label + '<div class="' +  entity['required']+ '">'
	html += '<ul class="tabs" data-tabs id="example-tabs">'
	content = '<div class="tabs-content" data-tabs-content="example-tabs">'
	for (var ptr in ids) { 
		childId = ids[ptr]
		childDomId = childId.replace(':','_')
		child = top.data['specifications'][childId]
		if (ptr == 0) {
			tab_active = ' is-active '
			aria = ' aria-selected="true" '
		}
		else {
			tab_active = ''
			aria = ''
		}

		html += '<li class="tabs-title'+tab_active+'"><a href="#panel_'+childDomId+'" ' + aria + '>' + renderLabel(child) + '</a></li>'
		content += '<div class="tabs-panel'+tab_active+'" id="panel_'+childDomId+'" style="padding:5px">'
		content += 		render(childId, entity['path'], depth+1, false, true )
		content += '</div>'		
	}
	content += '</div>'	
	html += '</ul>' + content + '</div></div>'
	html +=	renderHelp(entity) + '<br/>\n'
	return html
}

function renderInput(entity, label) {
	/*
	Add case for paragraph / textarea?
	 <textarea placeholder="None"></textarea>
	*/
	label = label.replace("</label>","") //We customize where label ends.

	html =		label
	html +=	'	<div class="input-group">\n'
	html +=	'		<input class="input-group-field '+entity['id']+'" id="'+entity['domId']+'" type="text" ' + getStringConstraints(entity) + entity['required']+ entity['disabled']  + getPlaceholder(entity) + '" />\n'
    html += 		renderUnits(entity)
	html +=	'	</div>\n'
	html += ' 	</label>'
	html +=		renderHelp(entity)
	return getFieldWrapper(entity, html)
}


/* NUMERIC DATATYPES HANDLED HERE */
function renderNumber(entity, label) {
	// ADD DECIMAL/FLOAT VALIDATION

	html =		label
	html +=	'	<div class="input-group">\n'
	html +=	'		<input class="input-group-field '+entity['id']+'" id="'+entity['domId']+'" type="text"' + entity['required']+ entity['disabled'] + getPlaceholder(entity)+'" />\n'
    html += 		renderUnits(entity)
	html +=	'	</div>\n'
	html +=		renderHelp(entity)
	return getFieldWrapper(entity, html)

	return html
}

function renderInteger(entity, label, minInclusive, maxInclusive) {

	html = label
	html +=	'	<div class="input-group">\n'
	html +=	'		<input class="input-group-field '+entity['id']+'" id="'+entity['domId']+'" type="number"' + entity['required'] + entity['disabled'] + getIntegerConstraints(entity, minInclusive, maxInclusive) + getPlaceholder(entity) + '" pattern="integer" />\n'
    html += 		renderUnits(entity)
	html +=	'	</div>\n'
	html +=	renderHelp(entity)
	return getFieldWrapper(entity, html)
}


function renderBoolean(entity) {

	html =	'	<div class="switch small" style="float:left;margin-right:10px;margin-bottom:0">\n'
	html +=	'	  <input id="'+entity['domId']+'" class="switch-input" type="checkbox" name="'+entity['id']+'"' + entity['required']+ entity['disabled'] + '/>\n' //class="switch-input '+entity['id'] + '" 
	html +=	'		<label class = "switch-paddle" for="'+entity['domId']+'"></label>\n'
	html +=	'	</div>\n'
	html +=	renderLabel(entity) 
	html +=	'	<br/>' + renderHelp(entity)
	return getFieldWrapper(entity, html)
}

function renderChoices(entity, label) {
	/* FUTURE: OPTION FOR RENDERING AS SELECT OPTIONS, RADIOBUTTONS OR CHECKBOXES ...

	*/
	picklistId = entity['id']
	html =		label
	html +=	'	<div class="input-group">\n'
	html +=	'		<select ' + getPlaceholder(entity) + '" class="input-group-field '+entity['id'] + '" id="'+entity['domId']+'"' + entity['required'] + entity['disabled'] + '>\n'
	html +=				renderChoice(top.data['picklists'][picklistId], 0)
	html +=	'		</select>\n'
	if ('lookup' in entity['features']) 
		html += '		<a class="input-group-label small" onclick="getChoices(this,\''+entity['id']+'\')">more choices...</a>\n'

	html +=	'	</div>\n'
	html += renderHelp(entity)

	return getFieldWrapper(entity, html)
}



function renderChoice(entity, depth, type="select") { 

	var html = ""
	if (depth > 10) return "MAX DEPTH PROBLEM WITH " + entity['id']
	if ('members' in entity) 
		var prefix = Array(depth+1).join("&nbsp; &nbsp; ")
		var memberIds = getSort(entity['members'],'picklists') 
		//console.log("List:",entity['uiLabel'], memberIds)
		for (var ptr in memberIds) {
			var memberId = memberIds[ptr]
			var part = top.data['picklists'][memberId]
			if (!part) // Should never happen.
				console.log("Error: picklist choice not available: ", memberId, " for list ",entity['id'])
			else {
				// Currently showing "hidden" feature as disabled.
				var disabled = getFeature(entity, memberId, 'hidden') ? ' disabled="disabled"' : '';
				var kidHTML = renderChoice(part, depth+1)
				var label = part['uiLabel']
				if ('label' in part && part['label'] != label)
					label = label + ' (' + part['label'] + ')'
				// Some extra pizaz for capitalizing labels that appear at 1st depth in hierarchic lists with descendants.
				var label = (depth == 0 && (kidHTML.length > 0)) ? label.toUpperCase() : label
				switch (type) {

					case "checkbox": // future
						break;
					case "radio": // future
						break;
					case "select":

					default:
						if (top.ontologyDetails == true) label = label + ' - ' + part['id'];
						html += '<option value="'+part['id']+'" class="depth'+depth+'" '+disabled+'>' + prefix + label + '</option>\n'
				}
			}
			html += kidHTML
		}
	return html
}

function renderUnits(entity) {
	// User is presented with choice of data-entry units if available.
	// Future: enable default unit/scale (cm, mm, m, km etc.) by placing that unit first in selection list
	// ISSUE: server has to unparse unit associated with particular input via some kind of name/unit syntax.
	if ('units' in entity) {
		var units = entity['units']
		var label = renderLabel(top.data['units'][units[0]])
		if (units.length == 1) 
			return '<a class="input-group-label small">'+ label + '</a>\n'

		var html ='<div class="input-group-button" style="font-weight:700;" ><select style="width:auto;cursor:pointer;" id="'+entity['domId']+'-obo:IAO_0000039">'
		for (var ptr in units) { //.slice(1)
			var unit = top.data['units'][units[ptr]]
			html += '		<option value="'+ unit['id'] + '">' + (unit['uiLabel'] ? unit['uiLabel'] : unit['label']) + ' &nbsp;</option>'
		}
		html += '</select></div>\n'
		return html
   	}
   	return ''
}


function renderHelp(entity) {
	// Currently help consists of displaying a field's user interface definition, or original ontology definition.
	var definition = ''
	if ('uiDefinition' in entity) definition = entity['uiDefinition'] 
	else if (definition in entity) definition = entity['definition']
	if (definition > '')
		return '	<p class="help-text ' + entity['id'] + '">'+ definition+'</p>\n'
  	return ''
 }

function renderLabel(entity) {
	if (!entity) return 'ERROR: Entity not defined'
	html = ''
	if (top.ontologyDetails === true) {
		html = renderContext(entity)
	}
	if (html == '') html = ' <label>' + entity['uiLabel'] + '</label>'
	return html
}


function renderContext(entity) {
	// Provide a label mouseover display of 
	var itemHTML = '<li><span class="infoLabel">ontology id:</span> ' + entity['id'] + '</li>\n'

	// Label is original ontology's label, not the user interface oriented one.
	if ('label' in entity && entity['label'] != entity['uiLabel'])
		itemHTML += '<li><span class="infoLabel">ontology label:</span> ' + entity['label'] + '</li>\n'
	if ('uiDefinition' in entity && entity['uiDefinition'] != entity['definition'])
		itemHTML += '<li><span class="infoLabel">ontology definition:</span> <i>' + entity['definition'] + '</i></li>\n'
	
	var properties = ['hasDbXref','hasSynonym','hasExactSynonym','hasNarrowSynonym']
	for (ptr in properties) {
		var item = properties[ptr]
		if (item in entity) {
			for (var ptr2 in entity[item]) {
				var val = entity[item][ptr2]
				if (val.substr(0,4) == 'http')
					val = '<a href="' + val + '" target ="_blank">'+val+'</a>'
				itemHTML += '<li><span class="infoLabel">' + item + ':</span> ' + val + '</li>\n'
			}
		}
	}
	// Add original definition if different.

	if (itemHTML > '') {
		itemHTML = 	['<label data-toggle="' + entity['domId'] + '_detail">', 
			'<i class="fi-magnifying-glass"></i>',
			entity['uiLabel'], '</label>',
			'<div class="dropdown-pane top" id="' + entity['domId'] + '_detail" data-dropdown data-hover="true" data-hover-pane="true"><ul>',
			itemHTML,
			'</ul></div>'].join('\n')
	}
	return itemHTML
}


/************************** UTILITIES ************************/

function getPlaceholder(entity) {
	return (' placeholder="'+ entity['datatype'].substr(entity['datatype'].indexOf(':') + 1 ) ) 
}

function getFieldWrapper(entity, html) {
	return ['<div class="field-wrapper field',
		('members' in entity) ? ' children' : '',
		'" ',
		getIdHTMLAttribute(entity['domId']),
		getHTMLAttribute(entity, 'cardinality-min'),
		getHTMLAttribute(entity, 'cardinality-max'),
		'>\n',
		 html,
		 '</div>\n'].join('')
}

function getIdHTMLAttribute(id) {
	return 'data-ontology-id="' + id + '" '
}

function getHTMLAttribute(entity, attribute) {
	return (attribute in entity) ? attribute +'="' + entity[attribute] + '" ' : ''
}

function getSort(members, myList) { // an object with entity ids as keys
	/* Complicated by the fact that some items, like individuals, may not have uiLabel.
	*/

	var memberIds = []
	for (var memberId in members) memberIds.push(memberId)

	var pl = top.data[myList]
	return memberIds.sort(function(a,b) {
		try {
			var aLabel = pl[a]['uiLabel'].toLowerCase()
			var bLabel = pl[b]['uiLabel'].toLowerCase()
		}
		catch (e) {
			//console.log("SORTING", memberIds)
			console.log("ERROR: Trying to sort a picklist but one item doesn't have a label:", a, b)
			return 0
		}

		if ( aLabel == bLabel) return 0
		return aLabel.localeCompare(bLabel) // Wierd, the ">" operator doesn't work for GEO items.

	})
}

function getFeatures(entity) {
	// Since a feature like "hidden" or "feature" may exist in both members and parts lists,
	// its a bit more hassle to determine where referrerId is to include the feature.

	var referrerId = entity['path'].slice(-2)[0]
	var referrer = top.data['specifications'][referrerId]
	if (!referrer) referrer = top.data['picklists'][referrerId]
	if (!referrer) {console.log("ERROR: can't find entity ", referrerId, " to get feature for." );return false }
	var myFeatures = {}
	var myLists = {'members':null,'parts':null}
	for (var myList in myLists) {
		if (myList in referrer) {
			var features = referrer[myList][entity['id']]
			if (features) {
				//console.log("FEATURES array? ",features)
				for (var ptr in features) {
					var myobj = features[ptr]
					if ('feature' in myobj) {
						if (typeof myobj['feature'] === 'object') 
							for (item in myobj['feature'])
								myFeatures[item] = myobj['feature'][item]
						else
							myFeatures[myobj['feature']] = myobj['feature']
					}
				}
				//console.log("FEATURES",myFeatures)
			}
		}
	}
	entity['features'] = myFeatures
}

function getFeature(entity, referrerId, feature) {
	// Features only exist with reference to a parent's relations to a child.
	// A feature like "hidden" or "feature" may exist in both members and parts lists
	var referrer = top.data['specifications'][referrerId]
	if (!referrer) referrer = top.data['picklists'][referrerId]
	if (!referrer) {console.log("ERROR: can't find entity ", referrerId, " to get feature for." );return false }

	for (myList in ['members','parts']) 
		if (myList in referrer) {
			var features = referrer[myList][entity['id']]
			if (features)
				for (var item in features) {
					if (feature in features[item]) {
						//console.log("found", feature, id, "in", entity['id']);
						return [features[item][feature]] //true
					}
				}
		}
	return false
}

function getConstraints(entity) {
	//Each constraint has "constraint", "datatype", and "value"
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

function getIntegerConstraints(entity, minInclusive, maxInclusive) {
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

function getStringConstraints(entity) {
	var constraints = getConstraints(entity), min, max, pattern
	min 	= 'xmls:minLength' in constraints ? ' minLength="'+constraints['xmls:minLength']+'" ' : ''
	max 	= 'xmls:maxLength' in constraints ? ' maxLength="'+constraints['xmls:maxLength']+'" ' : ''
	//size 	= 'xmls:length' in constraints ? ' size="'+constraints['xmls:length']+'" ' : ''
	pattern = 'xmls:pattern' in constraints ? ' pattern="' + constraints['xmls:pattern'] + '" ' : ''
	return min + max + pattern
}


function getCardinality(entity, referrerId) {
	/* Each part comes with a cardinality qualifier that indicates how many of
	that part can exist in an entity's data structure and by extension, on a form. 
	NOTE: limits on the data range of numeric or date values is handled separately in the
	constraints functions above.

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
	*/
	var referrerId = entity['path'].slice(-2)[0]
	var constraints = []
	var id = entity['id']
	var referrer = top.data['specifications'][referrerId]

	// Find given entity in parent (referrer) list of parts
	for (var cptr in referrer['parts'][id]) {

		// Each part will have a cardinality constraint:
		var condition = referrer['parts'][id][cptr]

		// Condition's 'value' attribute indicates cardinality exact|lower|upper range.

		var limit = 'value' in condition ? parseInt(condition['value']) : 1
		switch (condition['cardinality']) {
			case 'owl:someValuesFrom': // >= 1 of ...
				entity['cardinality-min'] = 1
				entity['required'] = ' required '
				break 
			case 'owl:qualifiedCardinality': // exactly ...
				entity['cardinality-min'] = limit
				entity['cardinality-max'] = limit
				entity['required'] = ' required '
				break 
			case 'owl:minQualifiedCardinality': // at least ...
				entity['cardinality-min'] = limit
				if (limit != 0) entity['required'] = ' required '
				break
			case 'owl:maxQualifiedCardinality': // at most ...
				entity['cardinality-max'] = limit
				break 
			default:
		}

	}
}


function getChoices(helper, entityId) {
	/*
	 We can set some picklists to have a dynamic lookup feature, indicated by
	 a "More choices" button next to the picklist.  When this button is 
	 clicked, a dynamic fetch of subordinate items to the one the user has 
	 selected is performed.  A user can then select one of the given items, if
	 any.  

	 The picklist's selection list tree can be dynamically extended/fetched?
	*/
	var select = $(helper).parent('div[class="input-group"]').find("select")
	var term = select.val().split(":")[1]
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

				alert ('DYNAMIC LOOKUP! These choices (subclasses of selected term) were dynamically retrieved from https://www.ebi.ac.uk/ols/:\n\n - ' + msg)
				//alert( entityId + ":" + select.val())
			}
			else 
				alert("Coming soon, dynamic lookup!\n\nYour choice has no underlying ontology selections")
		},
		error:function(XMLHttpRequest, textStatus, errorThrown) {alert('Dynamic Lookup is not currently available.  Either your internet connection is broken or the https://www.ebi.ac.uk/ols/ service is unavailable.')}
	})

	return false
}

function initFoundation() {

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
