const Prism = require('prismjs');
require('prismjs/components/prism-bash');
const code = "#!/bin/bash\necho hi\n# comment\nVAR=1\n";
const out = Prism.highlight(code, Prism.languages.bash, 'bash');
console.log('BASH HIGHLIGHT OUTPUT:\n');
console.log(out);
console.log('\n--- JS HIGHLIGHT ---\n');
console.log(Prism.highlight('function a() { return 1 }', Prism.languages.javascript, 'javascript'));
