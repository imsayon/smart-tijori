import "server-only";
import { readFileSync } from "node:fs";

export type Environment = NodeJS.ProcessEnv;

export class ServiceConfigurationError extends Error {}

export function required(env: Environment, name: string): string {
  const value = env[name];
  if (!value?.trim()) throw new ServiceConfigurationError(`Missing ${name}`);
  return value;
}

export function serviceUrl(env: Environment, name: string, protocols: string[]): URL {
  try {
    const url = new URL(required(env, name));
    if (!protocols.includes(url.protocol) || !url.hostname) throw new Error();
    return url;
  } catch (error) {
    if (error instanceof ServiceConfigurationError) throw error;
    throw new ServiceConfigurationError(`Invalid ${name}`);
  }
}

export function certificate(env: Environment, name: string): string {
  try {
    return readFileSync(required(env, name), "utf8");
  } catch (error) {
    if (error instanceof ServiceConfigurationError) throw error;
    throw new ServiceConfigurationError(`Cannot read ${name}`);
  }
}
