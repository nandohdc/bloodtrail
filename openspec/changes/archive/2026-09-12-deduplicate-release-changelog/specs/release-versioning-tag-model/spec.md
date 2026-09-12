## ADDED Requirements

### Requirement: The generated release changelog lists each merged change once

The release changelog generated for a repository release SHALL list each merged change once. When Release Please parses a repository that uses GitHub merge commits whose commit bodies repeat Conventional Commit message headers, the generated release section and release PR description SHALL NOT duplicate entries for the same change. A changelog deduplication step SHALL inspect release entries, identify merge commits duplicating branch commits within the same release section, and retain the branch commit entry while dropping the duplicate merge commit entry. The deduplication step SHALL preserve distinct changes that happen to share a commit subject when neither is a merge commit, and SHALL preserve all intermediate commits of a multi-commit pull request. A check mode SHALL assert that the release changelog contains no duplicate entries.

#### Scenario: Duplicate merge commit entries are removed
- **WHEN** a release section contains both a branch commit and a merge commit with identical commit subjects
- **THEN** the cleaner drops the merge commit entry and retains the branch commit entry

#### Scenario: Intermediate commits in multi-commit PRs are preserved
- **WHEN** a pull request contains multiple commits with distinct conventional commit subjects
- **THEN** all distinct branch commits are preserved in the changelog section

#### Scenario: Legitimate duplicate subjects from distinct non-merge commits are preserved
- **WHEN** two distinct non-merge commits in the same release section have identical subjects
- **THEN** both entries are preserved in the changelog section

#### Scenario: Changelog check mode detects uncleaned duplicates
- **WHEN** check mode is run against a changelog section containing merge-commit duplicates
- **THEN** check mode exits with non-zero exit code and reports the duplicate entries
