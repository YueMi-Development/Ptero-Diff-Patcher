# Snapshot Command (`snapshot.js`)

The `snapshot` command manages backup snapshots of the project directory. It allows listing available backups and restoring files to a specific snapshot state.

## Actions

### 1. List Snapshots

Lists all available backup archives (`.tar.gz`) stored in the configured backup directory, along with file sizes and creation dates.

```bash
ptero-patch snapshot list
```

### 2. Restore Snapshot

Extracts a specific backup archive and restores the files back into the project directory, overwriting current modified versions.

```bash
ptero-patch snapshot restore <snapshot-name>
```

---

## Workflow Flowchart

```mermaid
graph TD
    Start[Start snapshot] --> Action{Check Action}
    
    Action -->|list| CheckDir{Does backupDir exist?}
    CheckDir -->|No| LogNoDir[Log empty list & exit]
    CheckDir -->|Yes| ReadFiles[Scan folder for .tar.gz archives]
    ReadFiles --> ArchivesCount{Archives found?}
    ArchivesCount -->|No| LogNoDir
    ArchivesCount -->|Yes| PrintList[Display names, file sizes, & timestamps]
    
    Action -->|restore| CheckName{Is snapshot filename provided?}
    CheckName -->|No| ErrName[Log error and exit]
    CheckName -->|Yes| ResolvePath[Resolve absolute path of snapshot]
    ResolvePath --> FileExists{File exists on disk?}
    FileExists -->|No| ErrPath[Log error and exit]
    FileExists -->|Yes| Extract[Extract snapshot files to projectDir]
    Extract --> Success{Extract success?}
    Success -->|Yes| LogSuccess[Log success and exit]
    Success -->|No| ErrExtract[Log extraction error and exit]
    
    Action -->|Other| ErrAction[Log invalid action and exit]
```
