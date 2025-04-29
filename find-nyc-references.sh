#!/bin/bash

# Script to find remaining NYC references that need to be changed to Boston
echo "Searching for NYC references in the codebase..."
grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" --include="*.html" --include="*.md" --include="*.css" "NYC\|New York\|nyc\|new york" .
echo "Search complete. Review the results and update any remaining references." 