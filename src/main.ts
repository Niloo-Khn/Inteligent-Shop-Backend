import{createApp}from"./app.js";const port=Number(process.env.PORT??4100);createApp().listen(port);console.log(`Inteligent-Shop API listening on http://${process.env.HOST??"127.0.0.1"}:${port}`);
