# Generate Command (`generate.js`)

The `generate` command compares a range of Git commits in the target repository, calculates diffs, and outputs them as sequentially numbered, formatted patch files.

## Usage

```bash
ptero-patch generate --commits <commit1>..<commit2> [options]
```

### Options

*   **`-c, --commits <range>`**: (Required) The commit range (e.g. `HEAD~3..HEAD`).
*   **`-d, --dir <path>`**: The path to the Git repository.
*   **`-o, --output <path>`**: The output folder or filename prefix where patches are saved.

---

## Filename Format

Patch files are named according to a strict pattern:
`[sequence]-[commitHash]-[patchHash]-[NEW|MOD].patch`

*   **`sequence`**: A zero-padded 4-digit index (e.g., `0001`).
*   **`commitHash`**: The first 8 characters of the source Git commit SHA.
*   **`patchHash`**: The first 8 characters of the SHA-256 hash of the patch file content (for integrity validation).
*   **`NEW|MOD`**: Identifies whether the patch introduces new files (`NEW`) or modifies existing ones (`MOD`).

---

## Workflow Flowchart

```mermaid
graph TD
    Start[Start generate] --> CheckGit[Is projectDir a Git repository?]
    CheckGit -->|No| ErrGit[Log error & exit]
    CheckGit -->|Yes| ParseCommits[Parse commits range ref1..ref2]
    
    ParseCommits --> ResolveCommits[Resolve OIDs for ref1 and ref2]
    ResolveCommits --> DetermineOut[Determine output folder/prefix]
    
    DetermineOut --> CheckDir{Is output a dedicated folder?}
    CheckDir -->|Yes| RecreateDir[Safely clean & recreate folder]
    CheckDir -->|No| GetCommits[Walk commit history between ref1 & ref2]
    RecreateDir --> GetCommits
    
    GetCommits --> Loop[For each commit in range]
    Loop --> Diff[Generate diff against parent tree]
    Diff --> CalcHash[Compute SHA-256 of patch content]
    CalcHash --> FormatName[Format filename with index, commit SHA, patch hash, & type]
    FormatName --> Save[Save patch file to disk]
    Save --> Next{Has next commit?}
    Next -->|Yes| Loop
    Next -->|No| Done[Done]
```
