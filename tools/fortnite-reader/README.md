# Nexus local Fortnite replay reader

An independent console helper built from the complete sources in this directory. Distributed under GPL-3.0-or-later; see NOTICE.md, COPYING-GPL-3.0.txt and the retained MIT notices.

## Build for the packaged Windows app

Install the .NET 10 SDK and run from the repository root:

```sh
dotnet publish tools/fortnite-reader/NexusFortniteReader.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o src-tauri/resources/fortnite-reader
```

The published executable includes its .NET runtime. Nexus bundles it as `nexus-fortnite-reader.exe` next to the other application resources. CI checks that it starts before testing and packaging the Windows app.

## Protocol

One local `.replay` file path as the only argument; read-only access. Exactly one JSON object is written to stdout on success. Schema 1 contains match/account identifiers, recorder name, UTC start/end milliseconds, confirmed opened/destroyed counts, uncertain count, vehicle-data warning and parser/game versions. No catalogue downloads, authentication or network services are included. Exit 0 means success; 2 means still live or missing encryption key; 1 means failure with a message on stderr. Incomplete files and unknown recorder identities are rejected.

Nexus launches the helper at below-normal priority, bounds its execution time and output, and commits each confirmed match and counter addition together in SQLite. It preserves the existing counter, ignores pre-activation matches, binds to the first new replay's recorder account, and remembers match IDs across restarts. Disabling/re-enabling starts a new activation window; it does not clear the duplicate ledger. Restoring a database disables automatic counting until explicitly re-enabled.

This reads completed PC replays, not live memory. It updates at the end of a match. Inferred chest attribution is excluded and reported separately. Some destruction from vehicles may be missing. Fortnite format changes can require a reader update. Original replay samples and user data are not part of this repository.
