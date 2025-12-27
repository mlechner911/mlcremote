const Prism = require('prismjs');
require('prismjs/components/prism-bash');
require('prismjs/components/prism-python');
const bashCode = "#!/bin/bash\necho hi\n# comment\nVAR=1\n";
const pyCode = "# hello\ndef foo():\n    print('hi')\n";
console.log('BASH:\n', Prism.highlight(bashCode, Prism.languages.bash, 'bash'));
console.log('\nPYTHON:\n', Prism.highlight(pyCode, Prism.languages.python, 'python'));
