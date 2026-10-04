import { createHmac } from "node:crypto";
import type { ProductSource } from "./domain.js";
import { HttpError, object, text } from "./http.js";
import type { CommerceService } from "./services.js";

export type CatalogProduct = {
  source: ProductSource;
  name: string;
  description: string;
  imageUrl: string;
  additionalImages: string[];
  supplierPrice: number;
  originalPrice: number | null;
  currency: string;
  shippingSummary: string;
  rating: string;
  salesVolume: number;
};
export interface CatalogProvider { search(input:{keywords:string;currency:string;shipToCountry:string;page:number;pageSize:number;deliveryDays?:string}):Promise<CatalogProduct[]>; }
export interface ProductEnricher { enrich(product:CatalogProduct):Promise<{name:string;description:string}>; }

type AliProduct={product_id?:number|string;product_title?:string;product_detail_url?:string;product_main_image_url?:string;product_small_image_urls?:{string?:string[]}|string[];target_sale_price?:string;sale_price?:string;target_sale_price_currency?:string;sale_price_currency?:string;target_original_price?:string;original_price?:string;evaluate_rate?:string;lastest_volume?:number};
type AliResponse={aliexpress_affiliate_product_query_response?:{resp_result?:{resp_code?:number;resp_msg?:string;result?:{products?:{product?:AliProduct[]}|AliProduct[]}}};error_response?:{msg?:string;sub_msg?:string}};

export class AliExpressAffiliateClient implements CatalogProvider {
  constructor(private readonly appKey=process.env.ALIEXPRESS_APP_KEY??"",private readonly appSecret=process.env.ALIEXPRESS_APP_SECRET??"",private readonly trackingId=process.env.ALIEXPRESS_TRACKING_ID??"",private readonly endpoint=process.env.ALIEXPRESS_API_URL??"https://eco.taobao.com/router/rest"){}
  async search(input:{keywords:string;currency:string;shipToCountry:string;page:number;pageSize:number;deliveryDays?:string}):Promise<CatalogProduct[]>{
    if(!this.appKey||!this.appSecret)throw new HttpError(503,"catalog.aliexpress_not_configured");
    const parameters:Record<string,string>={method:"aliexpress.affiliate.product.query",app_key:this.appKey,sign_method:"hmac",timestamp:gmt8Timestamp(),format:"json",v:"2.0",simplify:"false",keywords:input.keywords,page_no:String(input.page),page_size:String(Math.min(50,input.pageSize)),target_currency:input.currency,target_language:"EN",ship_to_country:input.shipToCountry,...(this.trackingId?{tracking_id:this.trackingId}:{}),...(input.deliveryDays?{delivery_days:input.deliveryDays}:{})};
    parameters.sign=signTopRequest(parameters,this.appSecret);
    const response=await fetch(this.endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=utf-8"},body:new URLSearchParams(parameters),signal:AbortSignal.timeout(15_000)});
    if(!response.ok)throw new HttpError(502,"catalog.provider_unavailable");
    const payload=await response.json() as AliResponse;if(payload.error_response)throw new HttpError(502,"catalog.provider_error",{message:(payload.error_response.sub_msg??payload.error_response.msg??"AliExpress error").slice(0,300)});
    const result=payload.aliexpress_affiliate_product_query_response?.resp_result;if(result?.resp_code!==200)throw new HttpError(502,"catalog.provider_error",{message:(result?.resp_msg??"AliExpress error").slice(0,300)});
    const products=result.result?.products;const rows=Array.isArray(products)?products:products?.product??[];return rows.map(product=>normalizeAliProduct(product,input.deliveryDays));
  }
}
export function signTopRequest(parameters:Record<string,string>,secret:string):string{const canonical=Object.keys(parameters).filter(key=>key!=="sign").sort().map(key=>`${key}${parameters[key]??""}`).join("");return createHmac("md5",secret).update(canonical,"utf8").digest("hex").toUpperCase();}
function gmt8Timestamp(date=new Date()):string{const value=new Date(date.getTime()+8*60*60*1000);return value.toISOString().slice(0,19).replace("T"," ");}
function normalizeAliProduct(product:AliProduct,deliveryDays?:string):CatalogProduct{const images=product.product_small_image_urls;const additionalImages=Array.isArray(images)?images:images?.string??[];const supplierPrice=Number(product.target_sale_price??product.sale_price??0);const original=Number(product.target_original_price??product.original_price??0);return{source:{provider:"aliexpress",externalId:String(product.product_id??""),sourceUrl:product.product_detail_url??""},name:product.product_title??"",description:"",imageUrl:product.product_main_image_url??additionalImages[0]??"",additionalImages,supplierPrice:Number.isFinite(supplierPrice)?supplierPrice:0,originalPrice:Number.isFinite(original)&&original>0?original:null,currency:product.target_sale_price_currency??product.sale_price_currency??"USD",shippingSummary:deliveryDays?`Requested delivery window: ${deliveryDays} days`:"Confirm delivery time with AliExpress before publishing.",rating:product.evaluate_rate??"",salesVolume:Number(product.lastest_volume??0)};}

export class OpenAiProductEnricher implements ProductEnricher {
  constructor(private readonly apiKey=process.env.OPENAI_API_KEY??"",private readonly model=process.env.OPENAI_MODEL??"gpt-4o-mini"){}
  async enrich(product:CatalogProduct):Promise<{name:string;description:string}>{if(!this.apiKey)throw new HttpError(503,"catalog.ai_not_configured");const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${this.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:this.model,input:[{role:"system",content:"Rewrite supplier product copy for a clear online shop listing. Use only supplied facts. Never invent materials, sizes, safety claims, shipping promises, stock, warranties, or certifications."},{role:"user",content:JSON.stringify({supplierTitle:product.name,price:product.supplierPrice,currency:product.currency,rating:product.rating,salesVolume:product.salesVolume,shipping:product.shippingSummary})}],text:{format:{type:"json_schema",name:"product_copy",strict:true,schema:{type:"object",properties:{name:{type:"string"},description:{type:"string"}},required:["name","description"],additionalProperties:false}}}}),signal:AbortSignal.timeout(30_000)});if(!response.ok)throw new HttpError(502,"catalog.ai_unavailable");const payload=await response.json() as{output?:Array<{content?:Array<{type?:string;text?:string}>}>};const output=payload.output?.flatMap(item=>item.content??[]).find(item=>item.type==="output_text")?.text;if(!output)throw new HttpError(502,"catalog.ai_invalid_response");const value=JSON.parse(output) as{name?:unknown;description?:unknown};if(typeof value.name!=="string"||typeof value.description!=="string")throw new HttpError(502,"catalog.ai_invalid_response");return{name:value.name.slice(0,200),description:value.description.slice(0,5000)};}
}

export class CatalogService {constructor(private readonly commerce:CommerceService,private readonly provider:CatalogProvider=new AliExpressAffiliateClient(),private readonly enricher:ProductEnricher=new OpenAiProductEnricher()){}async search(shopId:string,input:unknown,ownerId:string){const shop=await this.commerce.assertShop(shopId,ownerId);const body=object(input);return this.provider.search({keywords:text(body,"keywords",200),currency:typeof body.currency==="string"?body.currency.toUpperCase():shop.currency,shipToCountry:typeof body.shipToCountry==="string"?body.shipToCountry.toUpperCase():"US",page:Math.max(1,Number(body.page)||1),pageSize:Math.max(1,Math.min(20,Number(body.pageSize)||12)),deliveryDays:typeof body.deliveryDays==="string"?body.deliveryDays:undefined});}async enrich(shopId:string,input:unknown,ownerId:string){await this.commerce.assertShop(shopId,ownerId);const body=object(input);const product=body.product;if(!product||typeof product!=="object")throw new HttpError(400,"catalog.product_required");return this.enricher.enrich(product as CatalogProduct);}}
