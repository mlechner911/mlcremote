const Prism = require('prismjs');
require('prismjs/components/prism-bash');
// require theme not needed for highlighting output
const code = "#!/bin/bash\necho hi\n# comment\nVAR=1";
const out = Prism.highlight(code, Prism.languages.bash, 'bash');
console.log(out);
console.log('\n--- plain text ---\n');
console.log(Prism.highlight('function a() { return 1 }', Prism.languages.javascript, 'javascript'));
