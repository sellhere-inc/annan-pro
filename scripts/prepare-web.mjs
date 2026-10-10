import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('../dist/index.html', import.meta.url);
let html = readFileSync(path, 'utf8');
html = html.replace(/<title>.*?<\/title>/, '<title>Annan Pro</title>');
html = html.replace('</head>', '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#000000"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Annan Pro"><link rel="apple-touch-icon" href="/icon-192.png"><style>html,body,#root{background:#000;color-scheme:dark}input:focus,textarea:focus{outline:2px solid #2997ff;outline-offset:2px}</style></head>');
writeFileSync(path, html);
console.log('Prepared Annan Pro Home Screen app.');
