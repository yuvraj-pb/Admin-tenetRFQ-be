import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import config from "../config/config.json";

dotenv.config();

const env = (process.env.NODE_ENV ?? "development") as keyof typeof config;
const dbConfig = config[env] ?? config.development;

const database =
  process.env.DB_DATABASE ?? process.env.DB_NAME ?? dbConfig.database;
const username = process.env.DB_USER ?? dbConfig.username;
const password = process.env.DB_PASSWORD ?? dbConfig.password ?? "";
const host = process.env.DB_HOST ?? dbConfig.host ?? "127.0.0.1";
const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;

const sequelize = new Sequelize(database, username, password, {
  host,
  port,
  dialect: "postgres",
  logging: process.env.DB_LOGGING === "true" ? console.log : false,
});

export default sequelize;
