// A `)` before `import.meta.url` (e.g. in a file name) must not hide the reference
export const parenURL = new URL(/* (v2) */ "../files/test.txt", import.meta.url);
