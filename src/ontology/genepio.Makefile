## Customize Makefile settings for genepio
## 
## If you need to customize your Makefile, make
## changes here rather than in the main Makefile

#imports/%_import.owl: imports/%_ontofox.txt
#	if [ $(IMP) = true ]; then curl -s -F file=@imports/$*_ontofox.txt -o $@ https://ontofox.hegroup.org/service.php; \
#	$(ROBOT) reduce -i "$@" -r ELK --xml-entities -o "$@"; fi

# ChEBI
mirror/chebi_import.owl:
	echo "No mirror for $@"

# Only fetches .owl if it doesn't exist or if .txt has later timestamp.
imports/chebi_import.owl: imports/chebi_ontofox.txt
	if [ $(IMP) = true ]; then curl -s -F file=@imports/chebi_ontofox.txt -o $@ https://ontofox.hegroup.org/service.php; \
	$(ROBOT) reduce -i "$@" -r ELK --xml-entities -o "$@"; fi

.PRECIOUS: imports/chebi_import.owl


# NCBITaxon
mirror/ncbitaxon_import.owl:
	echo "No mirror for $@"

# Only fetches .owl if it doesn't exist or if .txt has later timestamp.
imports/ncbitaxon_import.owl: imports/ncbitaxon_ontofox.txt
	if [ $(IMP) = true ]; then curl -s -F file=@imports/ncbitaxon_ontofox.txt -o $@ https://ontofox.hegroup.org/service.php; \
	$(ROBOT) reduce -i "$@" -r ELK --xml-entities -o "$@"; fi

.PRECIOUS: imports/ncbitaxon_import.owl



# General
mirror/general_import.owl:
	echo "No mirror for $@"

# Only fetches .owl if it doesn't exist or if .txt has later timestamp.
imports/general_import.owl: imports/general_ontofox.txt
	if [ $(IMP) = true ]; then curl -s -F file=@imports/general_ontofox.txt -o $@ https://ontofox.hegroup.org/service.php; \
	$(ROBOT) reduce -i "$@" -r ELK --xml-entities -o "$@"; fi

.PRECIOUS: imports/general_import.owl

#imports/chebi_import.owl: mirror/chebi.owl imports/chebi_terms_combined.txt
#	if [ $(IMP) = true ]; then $(ROBOT) extract -i $< -T imports/chebi_terms_combined.txt --force true --method BOT \
#		annotate --ontology-iri $(ONTBASE)/$@ $(ANNOTATE_ONTOLOGY_VERSION) --output $@.tmp.owl && mv $@.tmp.owl $@; fi
#
#.PRECIOUS: imports/chebi_import.owl

