# `/dokion autoresearch`

Run the autonomous goal-directed iteration loop (autoresearch) in Dokion.

## Usage
`dokion autoresearch [goal] [--auto] [--classic] [--target <percentage>] [--max-turns <n>] [--max-cost <dollars>] [--dry-run]`

## Description
Executes the Modify -> Verify -> Guard -> Keep/Rollback loop to iterate continuously against a metric or success predicate until reaching 100% completion / absolute success.
