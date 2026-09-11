import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SellerAccount } from "./domain.js";

type Entity = { id:string };
type Row = { data:string };
export interface PlatformRepository {
  saveAccount(value:SellerAccount):Promise<SellerAccount>;
  findAccount(id:string):Promise<SellerAccount|undefined>;
  findAccountByEmail(email:string):Promise<SellerAccount|undefined>;
  save<T extends Entity>(type:string,value:T,shopId?:string,ownerId?:string):Promise<T>;
  find<T>(type:string,id:string):Promise<T|undefined>;
  list<T>(type:string,shopId?:string,ownerId?:string):Promise<T[]>;
}
export class SqlitePlatformRepository implements PlatformRepository {
  private readonly db:DatabaseSync;
  constructor(path=process.env.DATABASE_PATH??"data/platform.sqlite") {
    const full=resolve(path);mkdirSync(dirname(full),{recursive:true});this.db=new DatabaseSync(full);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,data TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS entities(type TEXT NOT NULL,id TEXT NOT NULL,shop_id TEXT,owner_id TEXT,data TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(type,id)) STRICT;
      CREATE INDEX IF NOT EXISTS entities_scope_idx ON entities(type,shop_id,owner_id);`);
  }
  async saveAccount(value:SellerAccount){this.db.prepare("INSERT INTO accounts(id,email,data)VALUES(?,?,?) ON CONFLICT(id)DO UPDATE SET email=excluded.email,data=excluded.data").run(value.id,value.email,JSON.stringify(value));return value;}
  async findAccount(id:string){return this.account("id",id);}
  async findAccountByEmail(email:string){return this.account("email",email);}
  private account(field:"id"|"email",value:string){const row=this.db.prepare(`SELECT data FROM accounts WHERE ${field}=?`).get(value) as Row|undefined;return row?JSON.parse(row.data) as SellerAccount:undefined;}
  async save<T extends Entity>(type:string,value:T,shopId?:string,ownerId?:string){this.db.prepare("INSERT INTO entities(type,id,shop_id,owner_id,data,updated_at)VALUES(?,?,?,?,?,?) ON CONFLICT(type,id)DO UPDATE SET shop_id=excluded.shop_id,owner_id=excluded.owner_id,data=excluded.data,updated_at=excluded.updated_at").run(type,value.id,shopId??null,ownerId??null,JSON.stringify(value),new Date().toISOString());return value;}
  async find<T>(type:string,id:string){const row=this.db.prepare("SELECT data FROM entities WHERE type=? AND id=?").get(type,id) as Row|undefined;return row?JSON.parse(row.data) as T:undefined;}
  async list<T>(type:string,shopId?:string,ownerId?:string){let sql="SELECT data FROM entities WHERE type=?";const args:string[]=[type];if(shopId!==undefined){sql+=" AND shop_id=?";args.push(shopId);}if(ownerId!==undefined){sql+=" AND owner_id=?";args.push(ownerId);}sql+=" ORDER BY updated_at DESC";return(this.db.prepare(sql).all(...args) as Row[]).map(row=>JSON.parse(row.data) as T);}
}
