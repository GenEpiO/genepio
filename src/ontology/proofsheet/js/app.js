/********************** Ontology Entity Mart Prototype ************************

	This script provides the engine for displaying OBOFoundry.org compatible 
	ontologies, allowing one to search and browse any data representation model 
	items therein, as well
	as root terms and their branches, mainly renders a menu of ontology entities, and a form viewer
	that focuses on a selected entity.

	Author: Damion Dooley
	Project: GenEpiO.org Genomic Epidemiology Ontology
	Updated: May 28, 2017

	Note: we can get a dynamic list of OBOFoundry ontologies via: 
	http://sparql.hegroup.org/sparql?default-graph-uri=&query=SELECT+%3Fv+WHERE+%7B%3Fx+owl%3AversionIRI+%3Fv%7D&format=json   //&timeout=0&debug=on

	TO DO:

	 - seems like URL geem/#ontologyID/... isn't updating browser address bar, or on a RELOAD to load Form View.
	 - FIX: merge picklist and specification dictionaries.
	 - basic datatype & precision standard should be a function of unit, i.e. annotated onto unit choice for this field.
	 - disjunction tabbed interface has wrong required status?
	 - for select pulldown lists, enable mouseover of selected term to provide more detail, e.g. ontology id.
	 - FIX: contact specification - physician inherits first name, last name etc from person, but cardinality not shown.
	 - Must do a better job of identifying and grouping top-level items

	Author: Damion Dooley
	Project: genepio.org/geem

*/

/*********** ALL THE SETUP ***************************************************/

data = {}
focusEntityId = null
formSettings = {}

$( document ).ready(function() {

	OntologyForm.initFoundation()

	$(window).on('hashchange',function(){ 
		// GEEM focuses on entities by way of a URL with hash #[entityId]
	    if (location.hash.length > 0)
	    	// Better entity id detection?
		   	if (location.hash.indexOf(':') != -1) { //.substr(0,5) =='#obo:'
				top.focusEntityId = document.location.hash.substr(1).split('/',1)[0]
				// CHECK FOR VALID ENTITY REFERENCE IN SOME ONTOLOGY.
				// PREFIX SHOULD INDICATE WHICH ONTOLOGY SPEC FILE TO LOAD?
				myForm.renderEntity(top.focusEntityId)

				// When renderEntity is called, activate its tab
				$('#content-tabs').foundation('selectTab', '#content'); 
			}
	});


	// This control toggles the visibility of ontology ID's in the given 
	// form content (for reference during content review)
	$('input#toggleIdVisibility').on('change', function() {
		top.formSettings.ontologyDetails = $(this).is(':checked')
		myForm.renderEntity()
	})

	// Display all optional elements as label [+] for concise display.
	$('input#toggleMinimalForm').on('change', function() {
		top.formSettings.minimalForm = $(this).is(':checked')
		myForm.renderEntity()
	})

	$('#selectSpecification').on('change', function() {
		loadSpecification($(this).val())
	})

	// Provide type-as-you-go searching
	$("#searchField").on('keyup', function() {
		var text = $(this).val().toLowerCase()
		searchAsYouType(top.data.specifications, text)
	})

	$("#searchResults").on('mouseenter','i.fi-arrow-up.dropdown', searchResultContext)
	
	$("#makePackageForm").on('submit', function() {
		/* A package consists of 
		{
			name: string
			description: string
			version: int //auto-increment per update function.
			ontologies:	[
				{prefix: string // "genepio"; OBOFoundry ontology lower case name.
				version: string // identifier or if none, GEEM download date.
				}
			] 
			specifications:
				{}

		}


		*/
	})


	$("#shoppingCart")
		.on("click", 'div.cart-item', function(event) {
			event.stopPropagation(); // otherwise parent cart items catch same click
			if ($(event.target).is('i.fi-shopping-cart'))
				// Change state of shopping cart item as indicated by div.cart-item.data-ontology-Id
				cartCheck(this.dataset.ontologyId)
			else
				// Follow link if user didn't click
				return navigateToForm(this.dataset.ontologyId)
		})


	$("#shoppingCartTrash").on('click', function() {
		$('form#mainForm div[data-ontology-id]').removeClass('include exclude')
		$('#shoppingCart').empty()
	})

	//Default load of GenEpiO
	loadSpecification('data/ontology/genepio_ui.json')

	
});


/*********** ACTION *****************************************************
	This loads the json user interface oriented version of an ontology
	After ajax load of ontology_ui.json, top.data contains:
	{
		@context
		specifications
		units
		picklists
	}
*/
function loadSpecification(specification_file) {
	$.ajax({
		type: 'GET',
		url: specification_file,
		timeout: 10000, //10 sec timeout
		success: function( specification ) {

			// Setup Zurb Foundation user interface and form validation
			top.data = specification;

			myForm = new OntologyForm("#mainForm", top.data, top.formSettings) // Provide ID of form to populate.

			// Show Data Representation Model item menu on "Browse" tab.
			$("ul#entityMenu").empty().html(renderMenu('obo:OBI_0000658'))

			// Prepare browsable top-level list of ontology items
			html = ''
			for (specId in specification.specifications) {
				var spec = specification.specifications[specId]
				// Must do a better job of identifying and grouping top-level items  //! ('part_of' in spec) && 
				if (! ('member_of' in spec) && (!('datatype' in spec ))) {
					html += ['<li class="cart-item" data-ontology-id="',	specId,'">','<a href="#'+specId+'">',
					spec['uiLabel'], '</a>'].join('')
				}
			}
			$("ul#entityMenu").append('<hr/>' + html)

			// On Browse tab, enables eye icon click to show form without opening/closing the accordion.
			$('ul#entityMenu *').on('click', function(event) { 
	  			event.stopPropagation();
	  			if ($(event.target).is('i.fi-magnifying-glass') ) {
	  				myForm.renderEntity(getEntityId(event.target))
	  			}
			});

			$(document).foundation()
		},
		error:function(XMLHttpRequest, textStatus, errorThrown) {
			alert('Given resource could not be found: \n\n\t' + specification_file) 
		}
	});
}

function navigateToForm(ontologyId) {
	
	if (window.location.href.indexOf(ontologyId) == -1) {// not found
		window.location.replace('#' + ontologyId);
		//window.location.href = '#' + ontologyId

	}
	else
		// form already displayed, ensure tab is activated
		$('#content-tabs').foundation('selectTab', '#content'); 

	return false
}


function getEntity(ontologyId) {
	var entity = top.data['specifications'][ontologyId]
	if (!entity) entity = top.data['picklists'][ontologyId]
	return entity
}

function getEntityId(item) {
	return $(item).parents('.cart-item,.field-wrapper').first()[0].dataset.ontologyId
}

/*********** SEARCH AND RESULTS *************************/
function searchAsYouType(collection, text) {
	/* As user types text into searchField, exact substring search is conducted
	 through top.data.specifications entities (all of their numeric or textual 
	 attributes)
	*/
	text = text.toLowerCase()
	$("#searchResults").empty()
	var results = []
	if (text.length > 2) {
		var ontology_ids = filterIt(collection, text)
		for (id in ontology_ids) {
			results.push(renderCartObj(ontology_ids[id]))
		}
		
		// FIX FIX FIX
		// Picklist items are currently in a separate list.
		var ontology_ids = filterIt(top.data.picklists, text) 
		//if (ontology_ids.length > 0)
		//	$("#searchResults").append('<hr/><strong>Picklist Items</strong><br/>')
		for (id in ontology_ids) {
			results.push(renderCartObj(ontology_ids[id]))
		}
		// Sort results alphabetically.  Consider other sort metrics?
		results.sort(function(a,b){return a[0].localeCompare(b[0]) })
		resultsHTML = results.map(function(obj) {return obj[1]})
		$("#searchResults").append(resultsHTML.join('\n'))
	}

}

function filterIt(obj, searchKey) {
	/* Text Search of ontology contents via JSON specification.
	This looks at each "specification" entry's main fields, e.g.: label, 
	uiLabel, definition, uiDefinition, hasSynonym, hasNarrowSynonym, 
	hasExactSynonym.
	 */

    return Object.keys(obj).filter(function(key) { // key is specification ontology id.
      return Object.keys(obj[key]).some(function(key2) {
      	if (typeof obj[key][key2] === "object")
      		return false
      	else
      		// FUTURE: add wildcard searching?
      		return obj[key][key2].toLowerCase().includes(searchKey);
      })
    })
}

function searchResultContext(event) {
	/* Provide mouseover function to see dropdown menu that shows given item
	as well as any parent items that link to it via "has member" and "has part"
	and "is a" relations. Parents can be navigated to.
	*/
	parent = $('#navigateParentDropdown')
	if (parent.length) {
		$('#navigateParentDropdown').foundation('destroy') // or else subsequent dropdown position is fixed.
		$('#navigateParentButton,#navigateParentDropdown').remove()
	}
	var thisDiv = $(this).parent()
	var ontologyId = thisDiv.attr('data-ontology-id')

	// Though it is hidden, have to include button or else Foundation throws error.
	var domEl = ['<button id="navigateParentButton" data-toggle="navigateParentDropdown"></button>',
		'<div id="navigateParentDropdown" class="dropdown-pane"><ul>',
		getRelationsHTML(ontologyId),
		'</ul></div>'].join('')

	$(this).after($(domEl)).foundation() //Places it.
	var elem = new Foundation.Dropdown($('#navigateParentDropdown'), {hover:true, hoverPane:true});
	iconPosition = $(this).position()
	$('#navigateParentDropdown').foundation('open')
		.css('left', (iconPosition.left + 20) + 'px')
		.css('top', (iconPosition.top) + 'px')
		// Drop-down content is defined, now we ennervate the up-arrows.
		// each can replace content 
		.on('click','i.fi-arrow-up',function(event){
			// Insert shopping cart item 
			var target = $(event.target).parent()
			var targetId = target[0].dataset.ontologyId
			// DETECT IF ITEM HAS ALREADY HAD PARENTS ADDED?
			if ($('#navigateParentDropdown ul[data-ontology-id="'+targetId+'"]').length == 0 ) {
				target.parent().wrap('<ul data-ontology-id="'+targetId+'">')
				target.parent().before(getRelationsHTML(targetId))
			}
		})

}

function getRelationsHTML(ontologyId) {
	// Finds and draws relations as li links for given entity
	var entity = getEntity(ontologyId) 

	var filling = ''
	if ('parent' in entity) {
		filling += getRelationLink('parent', getEntity(entity['parent']))
	}
	// Possibly organize each entity's relations under a "relations" section?
	for (const relation of ['member_of','part_of']) {
		if (relation in entity) {
			for (const targetId of entity[relation]) {
				filling += getRelationLink(relation, getEntity(targetId))
			}
		}
	}
	return filling
}

function getRelationLink(relation, entity) {
	// Used in search results
	// Usually but not always there are links.  Performance boost if we drop this test.
	var links = ('parent' in entity || 'member_of' in entity || 'part_of' in entity)
	return ['<li data-ontology-id="' + entity['id'] + '">', relation, ': ',
		links ? '<i class="fi-arrow-up large"></i> ' : '',
		' <a href="#', entity['id'], '">' + entity['uiLabel'] + ' <i class="fi-magnifying-glass large"></i></a>',

		'</li>'].join('')
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
	
	if (formItem.is('.include')) {
		// ITEM already in shopping list, so downgrade to "exclude" list.
		items.removeClass('include').addClass('exclude')

		// If item is NOT top-level in form, we're done.
		if (formItem.parent('form').length == 0 ) {
		// otherwise 
			itemAnimate('#shoppingCartIcon', 'attention')
			return
		}
		// Otherwise, for top-level items, drop it immediately via .exclude state.
	}
	if (formItem.is('.exclude')) {
		// Item on exclusion list, so drop it entirely
		items.removeClass('exclude')
		// And remove all markings on subordinate items
		var mainFormEntity = $('#mainForm div.field-wrapper' + dataId)
		mainFormEntity.add(mainFormEntity.find('div.field-wrapper')).removeClass('include, exclude')
		cartItem.remove()
	}

}

function itemAnimate(item, effectClass) {
	// Apply given css effectClass to given DOM item for 1 second
	$(item).addClass(effectClass)
	setTimeout('$("'+item+'").removeClass("'+effectClass+'")', 1000)
}

function renderCartItem(ontologyId) {
	// NavFlag enables display of up-arrows that user can click on
	// to navigate to an item's parent.
	var ptr = ontologyId.lastIndexOf('/')
	// Get last path item id.
	var entityId = ptr ? ontologyId.substr(ptr+1) : ontologyId
	var entity = top.data['specifications'][entityId]
	if (!entity) entity = top.data['picklists'][entityId]
	if (!entity) entity = {'uiLabel':'[UNRECOGNIZED]'}
	return ['<div class="cart-item" ', getIdHTMLAttribute(ontologyId), '>',
		'<i class="fi-shopping-cart"></i>',
		'<a href="#', ontologyId, '">',	entity['uiLabel'], '</a></div>'].join('')
}


function renderCartObj(ontologyId) {
	// This version of renderCartItem is optimized for sorting, and is used in
	// search results page.  It also provides icons for navigating to an item's parent.
	var ptr = ontologyId.lastIndexOf('/')
	// Get last path item id.
	var entityId = ptr ? ontologyId.substr(ptr+1) : ontologyId
	var entity = top.data['specifications'][entityId]
	if (!entity) entity = top.data['picklists'][entityId]
	if (!entity) entity = {'uiLabel':'[UNRECOGNIZED:' + entityId + ']'}
	var html = ['<div class="cart-item" ', getIdHTMLAttribute(ontologyId), '>',
		'<i class="fi-shopping-cart"></i>',
		('parent' in entity) ? '<i class="fi-arrow-up dropdown parent"></i>' : '',
		('member_of' in entity) ? '<i class="fi-arrow-up dropdown member"></i>' : '',
		('part_of' in entity) ? '<i class="fi-arrow-up dropdown part"></i>' : '',
		'<a href="#', ontologyId, '">',	entity['uiLabel'], '</a></div>'].join('')
	
	return [entity['uiLabel'].toLowerCase(),html]

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
		if (depth > 0) {

			html = ['<li class="cart-item" data-ontology-id="',	entityId,'">',
			hasChildren ? '<a href="#">' : '<a href="#'+entityId+'">',
			entity['uiLabel'],
			hasChildren ? ' <i class="fi-magnifying-glass"></i>' : '',
			'</a>'].join('')
		}

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



function getdataSpecification(entityId) {
	/* The entity form is defined by 1 encompassing entity and its parts which are 
	defined in top.data components: specification, picklists and units 
	*/
	$("#helpDataSpecification").remove()
	$("#dataSpecification").html(JSON.stringify(getEntitySpec(null, entityId), null, 2))
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
			getEntitySpecItems(spec, entity, 'members', 'specifications') 
			// Though a member might not lead to a form element of any kind, still include?
			getEntitySpecItems(spec, entity, 'units', 'units')

		}
	}

	return spec
}

function getEntitySpecItems(spec, entity, type, table, inherited = false) {
	if (type in entity) {
		if (table == 'units') //WHY? table of ids?!
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
