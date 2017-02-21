OBO=http://purl.obolibrary.org/obo
ONT=genepio
BASE=$(OBO)/$(ONT)
SRC=$(ONT)-edit.owl
RELEASEDIR=../..
ROBOT= robot
OWLTOOLS= owltools


all: all_imports $(ONT).owl 
test: all
prepare_release: all 
	cp $(ONT).owl $(RELEASEDIR) &&\
	cp imports/*.owl $(RELEASEDIR)/imports/ &&\
	git add $(RELEASEDIR)/imports/*.owl &&\
	(test -f subsets/*.owl && cp subsets/*.owl $(RELEASEDIR)/subsets && git add $(RELEASEDIR)/subsets/* || echo "no subsets") &&\
	echo "Release files are now in $(RELEASEDIR) - now you should commit, push and make a release on github"

#Annotates genepio.owl ( $(ONT).owl ) file with release
$(ONT).owl: $(SRC)
	$(ROBOT) reduce -i $< -r ELK -s true annotate --xml-entities -V $(BASE)/releases/`date +%Y-%m-%d`/$(ONT).owl -o $@

# ALL OWL imports: apollo_sv chebi chmo doid efo envo eo ero evs fix gazetteer geo hardcoded hp ido irida model ncbitaxon ndf-rt oae obi ontology-metadata pato ro sio so stato symp typon uberon uo
# ALL OntoFox imports: brenda chebi chmo doid efo envo eo ero fix gazetteer geo hp ido ncbitaxon ndf-rt oae obi pato ro sio so stato uberon uo
# Ontofox can't import apollo_sv at moment - yeilds empty ontology file.
# Ontofox can't import geo either - the ids are ahead of what ontofox's geo ontology has?
# Ontofox ido import is bringing in BFO root tree when it shouldn't.
# 
IMPORTS = brenda chebi chmo doid efo envo eo ero hp ncbitaxon ndf-rt obi pato ro sio so stato uberon uo
# bfo gazetteer 
IMPORTS_OWL = $(patsubst %, imports/%_import.owl,$(IMPORTS))

# Make this target to regenerate ALL
all_imports: $(IMPORTS_OWL)

# Only fetches .owl if it doesn't exist or if .txt has later timestamp.
imports/%_import.owl: imports/%_ontofox.txt
	curl -s -F file=@imports/$*_ontofox.txt -o $@ http://ontofox.hegroup.org/service.php
	$(ROBOT) reduce -i $@ -r ELK -s true --xml-entities -o $@
	# All annotations are manually curated in the ontology-metadata.owl file
	# Because OWLAPI is parsing 1 line commented out annotations, make this step last:
	# In sed command on Macs we need the '.bak' after -i to avoid a parsing error
	sed -i '.bak' 's/<owl:AnnotationProperty[^>]*\/>/<!-- & -->/; s/<\/owl:AnnotationProperty>/& -->/; s/<owl:AnnotationProperty[^>]*">/<!-- &/;' $@ ||	sed -i 's/<owl:AnnotationProperty[^>]*\/>/<!-- & -->/; s/<\/owl:AnnotationProperty>/& -->/; s/<owl:AnnotationProperty[^>]*">/<!-- &/;' $@


# Use ROBOT, driven entirely by terms lists NOT from source ontology
#imports/%_import.owl: mirror/%.owl imports/%_terms.txt
#	$(ROBOT) extract -i $< -T imports/$*_terms.txt --method BOT -O $(BASE)/$@ -o $@

.PRECIOUS: imports/%_import.owl

# clone remote ontology locally, perfoming some excision of relations and annotations
#mirror/%.owl: $(SRC)
#	$(OWLTOOLS) $(OBO)/$*.owl --remove-annotation-assertions -l -s -d --remove-dangling-annotations  -o $@
#.PRECIOUS: mirror/%.owl

release: $(ONT).owl 
	cp $^ $RELEASEDIR && cp imports/*.owl $RELEASEDIR/imports
