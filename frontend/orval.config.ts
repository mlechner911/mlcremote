import { defineConfig } from 'orval';

export default defineConfig({
    api: {
        input: {
            target: '../backend/doc/openapi.yaml',
        },
        output: {
            mode: 'split',
            target: './src/api/generated.ts',
            client: 'react-query',
            mock: false,
            override: {
                mutator: {
                    path: './src/api/axios_custom.ts',
                    name: 'customInstance',
                },
            },
        },
    },
});
