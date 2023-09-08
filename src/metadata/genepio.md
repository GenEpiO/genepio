---
layout: ontology_detail
id: genepio
title: Genomic Epidemiology Ontology
jobs:
  - id: https://travis-ci.org/GenEpiO/genepio
    type: travis-ci
build:
  checkout: git clone https://github.com/GenEpiO/genepio.git
  system: git
  path: "."
contact:
  email: damion_dooley@sfu.ca
  label: Ontology Lead
  github: ddooley
description: The Genomic Epidemiology Ontology aims to provide a more comprehensive controlled vocabulary for infectious disease surveillance and outbreak investigations.
domain: stuff
homepage: https://github.com/GenEpiO/genepio
products:
  - id: genepio.owl
    name: "Genomic Epidemiology Ontology main release in OWL format"
  - id: genepio.obo
    name: "Genomic Epidemiology Ontology additional release in OBO format"
  - id: genepio.json
    name: "Genomic Epidemiology Ontology additional release in OBOJSon format"
  - id: genepio/genepio-base.owl
    name: "Genomic Epidemiology Ontology main release in OWL format"
  - id: genepio/genepio-base.obo
    name: "Genomic Epidemiology Ontology additional release in OBO format"
  - id: genepio/genepio-base.json
    name: "Genomic Epidemiology Ontology additional release in OBOJSon format"
dependencies:
- id: chebi
- id: doid
- id: envo
- id: foodon
- id: ncbitaxon
- id: obi
- id: ro
- id: uberon
- id: general

tracker: https://github.com/GenEpiO/genepio/issues
license:
  url: http://creativecommons.org/licenses/by/3.0/
  label: CC-BY
activity_status: active
---

Enter a detailed description of your ontology here. You can use arbitrary markdown and HTML.
You can also embed images too.

