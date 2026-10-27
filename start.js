import { createApp } from './app.js';
const app=createApp();
app.listen(Number(process.env.PORT)||3000,()=>console.log('Safiyah’s Gleam running on the configured port.'));
