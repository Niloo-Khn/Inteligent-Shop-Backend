import { App, type Json } from "./http.js";
import { Tokens } from "./auth.js";
import { SqlitePlatformRepository, type PlatformRepository } from "./repository.js";
import { AccountService, CommerceService } from "./services.js";
import { CatalogService } from "./catalog.js";

export function createApp(repo:PlatformRepository=new SqlitePlatformRepository()){
  const app=new App();const tokens=new Tokens();const accounts=new AccountService(repo);const commerce=new CommerceService(repo);const catalog=new CatalogService(commerce);
  const owner=(context:{headers:{authorization?:string}})=>tokens.verify(context.headers.authorization);
  app.route("GET","/health",async()=>({body:{service:"inteligent-shop",status:"ok"}}));
  app.route("POST","/accounts/register",async c=>({status:201,body:await accounts.register(await c.json()) as unknown as Json}));
  app.route("POST","/accounts/login",async c=>({body:await accounts.login(await c.json()) as Json}));
  app.route("GET","/accounts/me",async c=>({body:await accounts.me(owner(c)) as unknown as Json}));
  app.route("GET","/shops",async c=>({body:await commerce.shops(owner(c)) as unknown as Json}));
  app.route("POST","/shops",async c=>({status:201,body:await commerce.createShop(await c.json(),owner(c)) as unknown as Json}));
  app.route("POST","/shops/:shopId/catalog/aliexpress/search",async c=>({body:await catalog.search(c.params.shopId??"",await c.json(),owner(c)) as unknown as Json}));
  app.route("POST","/shops/:shopId/catalog/enrich",async c=>({body:await catalog.enrich(c.params.shopId??"",await c.json(),owner(c)) as unknown as Json}));
  app.route("GET","/shops/:shopId/products",async c=>({body:await commerce.products(c.params.shopId??"",owner(c)) as unknown as Json}));
  app.route("POST","/shops/:shopId/products",async c=>({status:201,body:await commerce.saveProduct(c.params.shopId??"",await c.json(),owner(c)) as unknown as Json}));
  app.route("GET","/shops/:shopId/products/:id",async c=>({body:await commerce.product(c.params.shopId??"",c.params.id??"",owner(c)) as unknown as Json}));
  app.route("PUT","/shops/:shopId/products/:id",async c=>({body:await commerce.saveProduct(c.params.shopId??"",await c.json(),owner(c),c.params.id) as unknown as Json}));
  app.route("GET","/shops/:shopId/orders",async c=>({body:await commerce.orders(c.params.shopId??"",owner(c)) as unknown as Json}));
  app.route("POST","/shops/:shopId/orders",async c=>({status:201,body:await commerce.importOrder(c.params.shopId??"",await c.json(),owner(c)) as unknown as Json}));
  app.route("GET","/shops/:shopId/orders/:id",async c=>({body:await commerce.order(c.params.shopId??"",c.params.id??"",owner(c)) as unknown as Json}));
  app.route("PUT","/shops/:shopId/orders/:id",async c=>({body:await commerce.updateOrder(c.params.shopId??"",c.params.id??"",await c.json(),owner(c)) as unknown as Json}));
  app.route("POST","/shops/:shopId/orders/:id/incidents",async c=>({status:201,body:await commerce.incident(c.params.shopId??"",c.params.id??"",await c.json(),owner(c)) as unknown as Json}));
  app.route("POST","/shops/:shopId/orders/:id/refunds",async c=>({status:201,body:await commerce.refund(c.params.shopId??"",c.params.id??"",await c.json(),owner(c)) as unknown as Json}));
  app.route("GET","/shops/:shopId/buyers",async c=>({body:await commerce.buyers(c.params.shopId??"",owner(c)) as unknown as Json}));
  app.route("GET","/shops/:shopId/promotions",async c=>({body:await commerce.promotions(c.params.shopId??"",owner(c)) as unknown as Json}));
  app.route("POST","/shops/:shopId/promotions",async c=>({status:201,body:await commerce.createPromotion(c.params.shopId??"",await c.json(),owner(c)) as unknown as Json}));
  app.route("GET","/shops/:shopId/recommendations",async c=>({body:await commerce.listRecommendations(c.params.shopId??"",owner(c)) as unknown as Json}));
  app.route("PUT","/shops/:shopId/recommendations",async c=>({body:await commerce.recommendations(c.params.shopId??"",await c.json(),owner(c)) as unknown as Json}));
  return app;
}
