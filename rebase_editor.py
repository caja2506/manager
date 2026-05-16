import sys
import re

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    content = f.read()

# Move the fixup line right after the target commit
lines = content.strip().split('\n')
new_lines = []
fixup_line = None

for line in lines:
    if '9a399d9' in line:
        fixup_line = line.replace('pick', 'fixup')
    else:
        new_lines.append(line)
        # After the b4fc532 commit, insert the fixup
        if 'b4fc532' in line and fixup_line is None:
            pass  # fixup line not found yet

# Reconstruct: find b4fc532 and insert fixup after it
final_lines = []
for line in new_lines:
    final_lines.append(line)
    if 'b4fc532' in line and fixup_line:
        final_lines.append(fixup_line)

with open(filepath, 'w') as f:
    f.write('\n'.join(final_lines) + '\n')
