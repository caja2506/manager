const fs = require('fs');
const filePath = 'src/components/tasks/editor/TaskControlPanel.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const startWrapperPattern = /return \(\s*<div className="w-full lg:w-\[35%\] flex flex-col bg-slate-950 border-l border-slate-800 overflow-y-auto relative">\s*<div className="p-4 lg:p-5 space-y-3">/;

const newStartWrapper = `return (
        <div className="w-full lg:w-2/3 flex flex-col lg:flex-row bg-slate-950 border-l border-slate-800 relative">
            
            {/* Middle Column */}
            <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 overflow-y-auto h-[40vh] lg:h-auto min-h-0">
                <div className="p-4 lg:p-5 space-y-3">`;

content = content.replace(startWrapperPattern, newStartWrapper);

const col3ExtractRegex = /(\{\/\* ─── PEER REVIEW ─── \*\/\}[\s\S]*?(?=\{\/\* ─── PLANIFICACIÓN ─── \*\/\}))/;
const match = content.match(col3ExtractRegex);

if (match) {
    const col3Content = match[1];
    content = content.replace(col3ExtractRegex, '');
    
    // We match the end of the return statement
    const endWrapperRegex = /            <\/div>\s*<\/div>\s*\);\s*\}/;
    
    const newEndWrapper = `            </div>
            </div>

            {/* Right Column */}
            <div className="flex-1 flex flex-col overflow-y-auto h-[40vh] lg:h-auto min-h-0">
                <div className="p-4 lg:p-5 space-y-3">

${col3Content}
                </div>
            </div>

        </div>
    );
}`;

    content = content.replace(endWrapperRegex, newEndWrapper);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Rewrite successful.");
} else {
    console.log("Could not find sections to extract.");
}
