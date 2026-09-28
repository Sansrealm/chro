import {createServer} from '../server.mjs';
import {resolve} from 'node:path';
const server=createServer({apiKey:'',storageDir:resolve('.review-state')});
await server.ready;
server.listen(8788,'127.0.0.1',()=>console.log('Review preview: http://127.0.0.1:8788 — synthetic mode, separate .review-state; existing .env and .state preserved.'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.closeAllConnections();server.close(async()=>{await server.whenClosed();process.exit(0);});});
