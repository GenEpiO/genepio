#!/bin/sh

# Note: Every line in a Makefile is run as a separate shell command.

OBO=http://purl.obolibrary.org/obo
ONT=genepio
BASE=$(OBO)/$(ONT)
SRC=$(ONT)-edit.owl
RELEASEDIR=../..
ROBOT= robot
OWLTOOLS= owltools


all: all_imports $(ONT).owl 
.PHONY: test
test: reason

# Run a basic reasoner to find inconsistencies
.PHONY: reason
reason: genepio-merged.owl
	$(ROBOT) reason --input $< --reasoner ELK

prepare_release: all 
	cp $(ONT).owl $(RELEASEDIR) &&\
	cp imports/*.owl $(RELEASEDIR)/imports/ &&\
	git add $(RELEASEDIR)/imports/*.owl &&\
	(test -f subsets/*.owl && cp subsets/*.owl $(RELEASEDIR)/subsets && git add $(RELEASEDIR)/subsets/* || echo "no subsets") &&\
	echo "Release files are now in $(RELEASEDIR) - now you should commit, push and make a release on github"

#Annotates genepio.owl ( $(ONT).owl ) file with release
$(ONT).owl: $(SRC)
	$(ROBOT) reduce -i $< -r ELK annotate --xml-entities -V $(BASE)/releases/`date +%Y-%m-%d`/$(ONT).owl --typed-annotation http://purl.org/dc/terms/date `date +%Y-%m-%d` xsd:date -o "$@"

# NEED TO ADD UPDATE ON dc.date too.

# Merge ontology and imports into one file 	
	$(ROBOT) merge --input $(ONT).owl --xml-entities --output $(ONT)-merged.owl
	sed -i '.bak' 's/<owl:imports[^>]*\/>/<!-- & -->/' $(ONT)-merged.owl

# ALL OWL imports: apollo_sv chebi chmo doid efo envo eo ero evs fix gazetteer geo hardcoded hp ido irida model ncbitaxon ndf-rt oae obi ontology-metadata pato ro sio so stato symp typon uberon uo
# ALL OntoFox imports: brenda chebi chmo doid efo envo eo ero foodon gazetteer hp ido ncbitaxon ncit ndf-rt obi pato po ro sio so stato uberon uberon
# Ontofox can't import apollo_sv at moment - yeilds empty ontology file.
# Ontofox can't import geo either - the ids are ahead of what ontofox's geo ontology has?
# 
IMPORTS=aro brenda chebi chmo doid efo envo eo ero foodon gazetteer hp ido ncbitaxon ncit omit obi pato po pco ro so stato uberon
# bfo # This one is hard-coded, doesn't change.

IMPORTS_OWL=$(patsubst %, imports/%_import.owl,$(IMPORTS))

# Make this target to regenerate ALL
all_imports: $(IMPORTS_OWL)

# Only fetches .owl if it doesn't exist or if .txt has later timestamp.
imports/%_import.owl: imports/%_ontofox.txt
	curl -s -F file=@imports/$*_ontofox.txt -o $@ http://ontofox.hegroup.org/service.php
	# Extra cleanup needed on gazetteer import
	# Only purpose of conda _test environment is to provide rdflib to python
	if [ "$*" == "gazetteer" ] ; then \
		source activate _test; \
		python ./gazetteer2.py "$@"; \
	fi	

	$(ROBOT) reduce -i "$@" -r ELK -s true --xml-entities -o "$@"
	# All annotations are manually curated in the ontology-metadata.owl file
	# Because OWLAPI is parsing 1 line commented out annotations, make this step last:
	# In sed command on Macs we need the '.bak' after -i to avoid a parsing error
	sed -i '.bak' 's/<owl:AnnotationProperty[^>]*\/>/<!-- & -->/; s/<\/owl:AnnotationProperty>/& -->/; s/<owl:AnnotationProperty[^>]*">/<!-- &/;' "$@" || sed -i 's/<owl:AnnotationProperty[^>]*\/>/<!-- & -->/; s/<\/owl:AnnotationProperty>/& -->/; s/<owl:AnnotationProperty[^>]*">/<!-- &/;' "$@"

.PRECIOUS: imports/%_import.owl

release: $(ONT).owl 
	cp $^ $RELEASEDIR && cp imports/*.owl $RELEASEDIR/imports
