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

	 - basic datatype & precision standard should be a function of unit, i.e. annotated onto unit choice for this field.
	 - disjunction tabbed interface has wrong required status?
	 - FIX: for <select><option>, shopping cart add/block/drop not working
	 - FIX: contact specification - physician inherits first name, last name etc from person, but cardinality not shown.
	 - Must do a better job of identifying and grouping top-level ontology items
	 - How to handle items that are not marked as datums?
	 - possibly try: http://knockoutjs.com/index.html
     - FIX: problem with 'specimen category'; selections linked "member of" some standard with annotation for their label, causing item itself tor surface in standard.
	 - FIX: "has component some XYZ" where XYZ is a composite entity fails to be recognized. using "min 1" instead of "some" is the workaround.
	 - FIX: Drug MIC has two units of measure, each with different basic data type - probably a dimensional analysis quality to annotate.

    Author: Damion Dooley
	Project: genepio.org/geem

*/

/*********** ALL THE SETUP ***************************************************/

specification = {}
focusEntityId = null
formSettings = {}
//ontologyLookupService = 'https://www.ebi.ac.uk/ols/search?q='
ontologyLookupService = 'http://purl.obolibrary.org/obo/'

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

	// Trigger JSON / EXCELL / YAML view of specification
	$('#specification-tabs').on('change.zf.tabs', getdataSpecification)

	$('#view_spec_download').on('click', downloadDataSpecification)

	// Provide type-as-you-go searching
	$("#searchField").on('keyup', function() {
		var text = $(this).val().toLowerCase()
		searchAsYouType(top.specification, text)
	})

	$('#toggleSearchDefinition').on('change', function() {
		searchAsYouType(top.specification, $("#searchField").val().toLowerCase())
	})

	$("#searchResults").on('mouseenter','i.fi-arrow-up.dropdown', displayContext)

	$("#content").on('mouseenter','i.fi-magnifying-glass', displayContext)

	$("#content").on('click', "i.fi-shopping-cart", function(event){
		// Check and update shopping cart include/exclude status of this item
		event.stopPropagation(); // otherwise parent cart items catch same click
		cartCheck(getEntityId(this))
		return false
	})

	//Setup in form code because #mainForm events overwritten: $("#mainForm").on('mouseenter','i.fi-magnifying-glass', displayContext)
			
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

			return false
		})


	$("#shoppingCartTrash").on('click', function() {
		$('form#mainForm div[data-ontology-id]').removeClass('include exclude')
		$('#shoppingCart').empty()
	})

	//Default load of GenEpiO
	loadSpecification('data/ontology/genepio-edit.json')


});



getIdHTMLAttribute = function(id) {
	return 'data-ontology-id="' + id + '" '
}

/*********** ACTION *****************************************************
	This loads the json user interface oriented version of an ontology
	After ajax load of ontology_ui.json, top.specification contains:
	{
		@context
		specifications
	}
*/
function loadSpecification(specification_file) {
	$.ajax({
		type: 'GET',
		url: specification_file,
		timeout: 10000, //10 sec timeout
		success: function( specification ) {

			// Setup Zurb Foundation user interface and form validation
			top.specification = specification['specifications'];

			// Provide context of form to populate.
			myForm = new OntologyForm("#mainForm", top.specification, top.formSettings, formCallback) 

			// Show Data Representation Model item menu on "Browse" tab.
			// Prepare browsable top-level list of ontology items
			/*
			html = ''
			for (specId in specification.specifications) {
				var spec = specification.specifications[specId]
				if (! ('member_of' in spec) && (!('datatype' in spec ))) {
					html += ['<li class="cart-item" data-ontology-id="',	specId,'">','<a href="#'+specId+'">',
					spec['uiLabel'], '</a>'].join('')
				}
			}
			*/

			//Have to reinsert this or reload doesn't fire up menu (zurb issue?)
			$('#panelEntities').html('<ul class="vertical menu" id="entityMenu" data-accordion-menu data-deep-link data-multi-open="false"></ul>')
			$("ul#entityMenu").html(renderMenu('obo:OBI_0000658') + '<hr/>') // + html

			// On Browse tab, enables eye icon click to show form without opening/closing the accordion.
			$('ul#entityMenu *').on('click', function(event) { 
	  			event.stopPropagation();
	  			if ($(event.target).is('i.fi-magnifying-glass') ) {
	  				myForm.renderEntity(getEntityId(event.target))
	  			}
			});

			// If browser URL indicates a particular entity, render it:
			if (location.hash.indexOf(':') != -1) { // ? also .substr(0,5) =='#obo:'
				top.focusEntityId = document.location.hash.substr(1).split('/',1)[0]
				// CHECK FOR VALID ENTITY REFERENCE IN SOME ONTOLOGY.
				// PREFIX SHOULD INDICATE WHICH ONTOLOGY SPEC FILE TO LOAD?
				myForm.renderEntity(top.focusEntityId)
			}

			$(document).foundation()

		},
		error:function(XMLHttpRequest, textStatus, errorThrown) {
			alert('Given resource could not be found: \n\n\t' + specification_file) 
		}
	});
}

function formCallback(formObj) {
	//This is executed whenever a new form is rendered.
	if (window.setShoppingCart) {
		setShoppingCart(formObj) 
		setFormSelectOptionsCart(formObj)
	}
}


setShoppingCart = function (formObj) {
	// UPDATE SHOPPING CART STATUS in renderEntity()
	// ISSUE is foundation zurb selection lists redrawn each time, so need statuses added in that code.
	$('#content div.field-wrapper')
		.addClass('cart-item')
		.prepend('<i class="fi-shopping-cart"></i>')

	$('#shoppingCart div.cart-item').each(function(index){
		var status = ''
		if ($(this).is('.include') ) status = 'include'
		if ($(this).is('.exclude') ) status = 'exclude'

		$('#content div.field-wrapper[' + getIdHTMLAttribute($(this)[0].dataset.ontologyId) + ']').addClass(status)
	})
}


function setFormSelectOptionsCart(formObj) {
	// Adds shopping cart and magnifying glass to individual <select><option> item if it doesn't have one...
	// This has to be done runtime (via mouseover) because only then does foundation render it.
	// FUTURE: FORM Hides/DROPS HIDDEN <option> in renderChoice().
	$('#content select.regular').on('chosen:showing_dropdown', function(event) {

		var control = $(this).next().find('ul.chosen-results')
		var select = $(this) //.parent('div').prev('select')
		var selectId = select.attr('id') // FUTURE: generalize to data-ontology-id
		var selectOptions = select.children('option')

		$(control).children('li').each(function (index) {
			if ($(this).is('.active-result')) {

				// We need to copy the value from the existing <select><option>
				// into the data-ontology-id for this <li>.
				var id = selectOptions.eq(index+1).attr('value') //Get corresponding option value.
				var pathId = selectId + '/' + id
				$(this).attr('data-ontology-id',pathId)
				$(this).addClass('cart-item')
				var cartItem = $('#shoppingCart [data-ontology-id="' + pathId +'"]')
				var cart = $('<i class="fi-shopping-cart option"></i>')
				if (cartItem.length>0)
					if (cartItem.is('.include') ) $(this).add(cart).addClass('include')
					else if (cartItem.is('.exclude') ) $(this).add(cart).addClass('exclude')

				// Couldn't figure out how to keep selection window open
				$(this).after(cart) //awkward, cart requires margin-top:-30px in stylesheet.
				if (formObj.settings.ontologyDetails)
					$(this).prepend('<i class="fi-magnifying-glass"></i> &nbsp;')
			}
		})

	})

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
	var entity = top.specification[ontologyId]
	//if (!entity)
	//	entity = top.specification['units'][ontologyId]
	return entity
}

function getEntityId(item) {
	// Determine relevant ontology ID for given entity
	if ($(item).is('i.fi-shopping-cart.option')) 
		return $(item).prev().attr('data-ontology-id')
	return $(item).parents('.cart-item,.field-wrapper').first()[0].dataset.ontologyId
}

/*********** SEARCH AND RESULTS *************************/
function searchAsYouType(collection, text) {
	/* As user types text (more than 2 characters) into searchField, exact
	 substring search is conducted through top.specification entities (all
	 of their numeric or textual attributes)
	*/
	text = text.toLowerCase()
	$("#searchResults").empty()
	var results = []
	if (text.length > 2) {
		var ontology_ids = filterIt(collection, text)
		for (id in ontology_ids) {
			results.push(renderCartObj(ontology_ids[id]))
		}
		// Sort results alphabetically.  
		// Consider other sort metrics?
		results.sort(function(a,b){return a[0].localeCompare(b[0]) })
		resultsHTML = results.map(function(obj) {return obj[1]})
		$("#searchResults").append(resultsHTML.join('\n'))
	}

}

function filterIt(collection, searchKey) {
	/* Text Search of ontology contents via JSON specification.
	This looks at each "specification" entry's main fields, e.g.: label, 
	uiLabel, definition, uiDefinition, hasSynonym, hasNarrowSynonym, 
	hasExactSynonym.
	 */
	 var details = $('#toggleSearchDefinition:checked').length

    return Object.keys(collection).filter(function(key) { // key is ontology term id.
      return Object.keys(collection[key]).some(function(key2) { 
      	// key2 is name of object property like label, definition, component

      	if (typeof collection[key][key2] === "object") 
      		//i.e. skip entity components, models, features.
      		return false
      	else
      		if (!details && (key2 == 'definition' || key2 == 'uiDefinition'))
      			return false
      		// FUTURE: add wildcard searching?
      		return collection[key][key2].toLowerCase().includes(searchKey);
      })
    })
}

function displayContext(event) {
	/* Provide mouseover function to see dropdown menu that shows given item
	as well as any parent items that link to it via "has member" and "has part"
	and "is a" relations. Parents can be navigated to.
	*/
	parent = $('#displayContext')
	if (parent.length) {
		$('#displayContext').foundation('destroy') // or else subsequent dropdown position is fixed.
		$('#displayContextButton,#displayContext').remove()
	}
	var thisDiv = $(this).parents('[data-ontology-id]').first()
	var ontologyPath = thisDiv.attr('data-ontology-id')
	var pathDivider = ontologyPath.lastIndexOf('/')
	if (pathDivider != -1)
		var ontologyId = ontologyPath.substr(pathDivider+1)
	else
		var ontologyId = ontologyPath 	

	var content = '<div id="displayContext" class="dropdown-pane"><ul>'
	if ($(this).is('.fi-magnifying-glass')) {
		console.log('looking up label')
		content += getOntologyDetailHTML(ontologyId) 
	}
	else //'.fi-arrow-up'
		content += '<ul>' + getRelationsHTML(ontologyId) + '</ul>'

	// Though it is hidden, have to include button or else Foundation throws error.
	content = '<button id="displayContextButton" data-toggle="displayContext">&nbsp; &nbsp;</button>' + content // style="position:absolute"

	$('body').after(content).foundation() //Places it.

	var elem = new Foundation.Dropdown($('#displayContext'), {hover:true, hoverPane:true});
	var iconPosition = $(this).offset()
	
	//So mouseout works
	$('#displayContextButton')
		.css('left', (iconPosition.left) + 'px')
		.css('top', (iconPosition.top) + 'px')

	$('#displayContext').foundation('open')
		.css('left', (iconPosition.left + 20) + 'px')
		.css('top', (iconPosition.top) + 'px')

	if ($(this).is('.fi-arrow-up'))
		// Drop-down content is defined, now we ennervate the up-arrows.
		// each can replace content 
		$('#displayContext').on('click','i.fi-arrow-up',function(event){
			// Insert shopping cart item 
			var target = $(event.target).parent()
			var targetId = target[0].dataset.ontologyId
			// DETECT IF ITEM HAS ALREADY HAD PARENTS ADDED?
			if ($('#displayContext ul[data-ontology-id="'+targetId+'"]').length == 0 ) {
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
	for (const relation of ['member_of','otherParent']) {
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
	var links = ('parent' in entity || 'member_of' in entity || 'otherParent' in entity)
	return ['<li data-ontology-id="' + entity['id'] + '">', relation, ': ',
		links ? '<i class="fi-arrow-up large"></i> ' : '',
		' <a href="#', entity['id'], '">' + entity['uiLabel'] + ' <i class="fi-magnifying-glass large"></i></a>',

		'</li>'].join('')
}

function getOntologyDetailHTML(ontologyId) {

	// This links directly to form for this entity.  Not in context of larger form.
	// Problem is that recursion to fetch parts from parent runs into parents that 
	// have no further path.
	// ALSO SELECT LIST CHOICES DON'T HAVE DEPTH STEMMING FROM PARENT ENTITY, only from ???
	entity = getEntity(ontologyId)
	entityId = entity['id'].split(':')[1]
	var labelURL = '<a href="' + top.ontologyLookupService + entityId + '" target="_blank">' + entity['uiLabel'] + '</a>' 

	/* Provide a label mouseover display of underlying ontology details
	like original ontology definition, term id, synonyms, etc.
	*/
	var itemHTML = '<li><span class="infoLabel">ontology id:</span> ' + entity['id'] + '</li>\n'

	// Label is original ontology's label, not the user interface oriented one.
	if ('label' in entity && entity['label'] != entity['uiLabel'])
		itemHTML += '<li><span class="infoLabel">ontology label:</span> ' + entity['label'] + '</li>\n'
	// Add original definition if different.
	if ('definition' in entity && entity['uiDefinition'] != entity['definition'])
		itemHTML += '<li><span class="infoLabel">ontology definition:</span> <i>' + entity['definition'] + '</i></li>\n'
	
	// Hardcode properties that you want to show from specification here:
	var properties = ['hasDbXref','hasSynonym','hasExactSynonym','hasNarrowSynonym']
	for (ptr in properties) {
		var item = properties[ptr]
		if (item in entity) {
			for (var ptr2 in entity[item]) {
				var val = entity[item][ptr2]
				if (val.substr(0,4) == 'http') // covers https:// too.
					val = '<a href="' + val + '" target ="_blank">'+val+'</a>'
				itemHTML += '<li><span class="infoLabel">' + item + ':</span> ' + val + '</li>\n'
			}
		}
	}


	// Enable mouseover display of above.
	itemHTML = 	[labelURL, itemHTML].join('\n')

	return itemHTML
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
	var items = $('.cart-item' + dataId)
	var formItem = $('#mainForm .cart-item' + dataId) // CONGLOMERATE?
	var cartItem = $('#shoppingCart .cart-item' + dataId)

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
	var entity = top.specification[entityId]
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
	var entity = top.specification[entityId]
	if (!entity) entity = {'uiLabel':'[UNRECOGNIZED:' + entityId + ']'}
	var html = ['<div class="cart-item" ', getIdHTMLAttribute(ontologyId), '>',
		'<i class="fi-shopping-cart"></i>',
		('parent' in entity) ? '<i class="fi-arrow-up dropdown parent"></i>' : '',
		('member_of' in entity) ? '<i class="fi-arrow-up dropdown member"></i>' : '',
		('otherParent' in entity) ? '<i class="fi-arrow-up dropdown part"></i>' : '',
		'<a href="#', ontologyId, '">',	entity['uiLabel'], '</a></div>'].join('')
	
	return [entity['uiLabel'].toLowerCase(),html]

}



/*********** ENTITY MENU RENDERER *************************/
function renderMenu(entityId, depth = 0 ) {

	var html = ""
	var entity = top.specification[entityId]
	if (entity) {
		if ('parent' in entity && parent['id'] == entityId) {
			console.log("Node: " + entityId + " is a parent of itself and so is not re-rendered.")
			return html
		}

		var hasChildren = ('models' in entity)
		if (depth > 0) {

			html = ['<li class="cart-item" data-ontology-id="',	entityId,'">',
			//hasChildren ? '<a href="#">' : '<a href="#'+entityId+'">',
			 '<a href="#'+entityId+'">',
			entity['uiLabel'],
			hasChildren ? ' <i class="fi-magnifying-glass"></i>' : '',
			'</a>'].join('')
		}

		// See if entity has subordinate parts that need rendering:
		if (hasChildren) {
			for (var memberId in entity['models']) {
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



function getdataSpecification() {
	/* This is called each time a dataSpecification is loaded, and also when a
	 specification tab is clicked.

	INPUT
	active specification tab: tab user just clicked on, or one active when form loaded
	top.focusEntityId: The current entity being focused on, looked up in
                       top.specification components: specification, picklists and units 
    OUTPUT
    - #dataSpecification div or field loaded with textual representation.
    - download button activated
	*/

	var selected_tab = $('#specification-tabs > li.is-active > a[aria-selected="true"]').attr('aria-controls')

	if (selected_tab) {
		var content = ''
		$("#helpDataSpecification").remove()

		switch (selected_tab) {
			case 'json_specification':
				content = JSON.stringify(getEntitySpec(null, top.focusEntityId), null, 2)
				break; 
			case 'yml_specification':
				//content = YAML.stringify(getEntitySpec(null, top.focusEntityId), 4)  //4=# indentation characters
				content = jsyaml.dump(getEntitySpec(null, top.focusEntityId), 4)  //4=# indentation characters
				break;

			case 'json_form_specification':
				content = JSON.stringify(getEntitySpecForm(top.focusEntityId), null, 2)
				break; 
				
			case 'yml_form_specification':
				//content = YAML.stringify(getEntitySpecForm(top.focusEntityId))
				content = jsyaml.dump(getEntitySpecForm(top.focusEntityId), 4) //indent of 4
				break; 
			case 'xlsm_specification':
				alert('Coming soon!')
				break; 
		}

		$("#dataSpecification").html(content)

		if (content.length > 0) // If something to download, activate download button
			$("#spec_download").removeClass('disabled').removeAttr('disabled')
		else 
			$("#spec_download").addClass('disabled').attr('disabled','disabled')

	}

}


function downloadDataSpecification() {
	/* This creates dynamic file download link for a given ontology entity. 
	File generated from #dataSpecification field contents directly.
	It fires when user clicks download button of specification, immediately 
	before file is downloaded.

	INPUT
		Quick and dirty file suffix detection based on dom id: yml_ | json_ | tsv_ | xlsx_ ...

	OUTPUT
	Download file link has attributes:
		download = [ontology_id].[file type corresponding to first word of selected tab]
		href = base 64 encoding of #dataSpecification field.
	*/
	if ($("#dataSpecification").html().length) {
		var entity = top.specification[top.focusEntityId]
		var selected_tab = $('#specification-tabs > li.is-active > a[aria-selected="true"]').attr('aria-controls')
		
		// File name is main ontology id component + file suffix.
		var file_name = entity['id'].split(':')[1] + '.' + selected_tab.split('_')[0]  
		var content = window.btoa($("#dataSpecification").text()) // Convert to base 64.
		$("#view_spec_download")
			.attr('download', file_name)
			.attr('href', 'data:text/csv;base64,' + content)
	}
}



function getEntitySpec(spec, entityId = null, inherited = false) {
	// Recursively copy the entityId specification element and all its
	// underlings into a a single javascript object.
	if (spec == null)
		spec = {}

	if (entityId in top.specification) {
		var entity = top.specification[entityId]
		if (entity) {
			spec[entityId] = entity
			
			if (inherited == true) {
				// Entity inherits primary ancestors' parts (the ones that led from start of rendering to here). 
				var parentId = entity['parent']
				if (parentId != 'obo:OBI_0000658') //Top level OBI "data representation model"
					getEntitySpec(spec, parentId, true)
			}

			getEntitySpecItems(spec, entity, 'components')
			getEntitySpecItems(spec, entity, 'models') 
			getEntitySpecItems(spec, entity, 'units')

		}
	}

	return spec
}

function getEntitySpecItems(spec, entity, type, inherited = false) {
	/*
	FUTURE: units array will be ordered so that favoured unit is first.
	*/
	if (type in entity) {
		if (type == 'units')
			// units is an array; 
			for (var ptr in entity[type]) { 
				var partId = entity[type][ptr]
				spec[partId] = top.specification[partId] // load object
				getEntitySpec(spec, partId) // and we make sure 
			}
		else
			// models, components, which are dictionaries
			for (var partId in entity[type]) { 
				spec[partId] = top.specification[partId] // load object
				getEntitySpec(spec, partId)
			} 
	}
}
