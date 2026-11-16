# Local Fortnite replay reader

The helper is distributed under GPL-3.0-or-later because its OozSharp decompressor contains GPL-3.0-or-later code by Powzix / SL-x-TnT. See COPYING-GPL-3.0.txt and the copyright headers in vendor/lib/OozSharp. MIT components retain their notices. The complete corresponding helper source and build project are provided in this directory.

Parsing libraries and analysis are derived from LED-N/Fortnite-ChestCounter commit 1ec3636 (MIT), itself based on Shiqan/FortniteReplayDecompressor (MIT) and OozSharp. See the included license files and vendor/lib/PATCHES.md.

Nexus compiles only the parser, models, translations and a local console entry point; no updater, GUI or network catalogue. Nexus also disables upstream debug payload dumps. Changes: expose inference-based attribution separately; publish only confirmed opened/destroyed events for the replay recorder; reject incomplete/unidentified files. The original samples are private and are not distributed in this repository. This is an unofficial file reader, not an Epic service.
