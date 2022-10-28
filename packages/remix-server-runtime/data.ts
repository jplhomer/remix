import { json, isResponse, isRedirectResponse } from "./responses";
import type {
  ActionFunction,
  DataFunctionArgs,
  LoaderFunction,
} from "./routeModules";
import { ErrorResponse } from "./router";

/**
 * An object of unknown type for route loaders and actions provided by the
 * server's `getLoadContext()` function.
 */
export interface AppLoadContext {
  [key: string]: unknown;
}

/**
 * Data for a route that was returned from a `loader()`.
 */
export type AppData = any;

export async function callRouteAction({
  loadContext,
  routeId,
  action,
  params,
  request,
  isRemixRouterRequest,
}: {
  loadContext: AppLoadContext;
  routeId: string;
  action?: ActionFunction;
  params: DataFunctionArgs["params"];
  request: Request;
  isRemixRouterRequest?: boolean;
}) {
  if (!action) {
    let pathname = new URL(request.url).pathname;
    let msg =
      `You made a ${request.method} request to "${pathname}" but did not provide ` +
      `an \`action\` for route "${routeId}", so there is no way to handle the request.`;
    throw new ErrorResponse(405, "Method Not Allowed", new Error(msg), true);
  }

  let result;
  try {
    result = await action({
      request: stripDataParam(stripIndexParam(request)),
      context: loadContext,
      params,
    });
  } catch (error: unknown) {
    if (!isResponse(error)) {
      throw error;
    }

    if (!isRedirectResponse(error)) {
      error.headers.set("X-Remix-Catch", "yes");
      // This needs to be thrown so @remix-run/router knows to handle it as an error
      // and not a successful returned response
      if (isRemixRouterRequest) {
        throw error;
      }
    }
    result = error;
  }

  if (result === undefined) {
    throw new Error(
      `You defined an action for route "${routeId}" but didn't return ` +
        `anything from your \`action\` function. Please return a value or \`null\`.`
    );
  }

  return isResponse(result) ? result : json(result);
}

export async function callRouteLoader({
  loadContext,
  routeId,
  loader,
  params,
  request,
  isRemixRouterRequest,
}: {
  request: Request;
  routeId: string;
  loader?: LoaderFunction;
  params: DataFunctionArgs["params"];
  loadContext: AppLoadContext;
  isRemixRouterRequest?: boolean;
}) {
  if (!loader) {
    let pathname = new URL(request.url).pathname;
    let msg =
      `You made a ${request.method} request to "${pathname}" but did not provide ` +
      `a \`loader\` for route "${routeId}", so there is no way to handle the request.`;
    throw new ErrorResponse(405, "Method Not Allowed", new Error(msg), true);
  }

  let result;
  try {
    result = await loader({
      request: stripDataParam(stripIndexParam(request)),
      context: loadContext,
      params,
    });
  } catch (error: unknown) {
    if (!isResponse(error)) {
      throw error;
    }

    if (!isRedirectResponse(error)) {
      error.headers.set("X-Remix-Catch", "yes");
      // This needs to be thrown so @remix-run/router knows to handle it as an error
      // and not a successful returned response
      if (isRemixRouterRequest) {
        throw error;
      }
    }
    result = error;
  }

  if (result === undefined) {
    throw new Error(
      `You defined a loader for route "${routeId}" but didn't return ` +
        `anything from your \`loader\` function. Please return a value or \`null\`.`
    );
  }

  return isResponse(result) ? result : json(result);
}

export async function callRouteActionRR({
  loadContext,
  action,
  params,
  request,
  routeId,
}: {
  request: Request;
  action: ActionFunction;
  params: DataFunctionArgs["params"];
  loadContext: AppLoadContext;
  routeId: string;
}) {
  let result = await action({
    request: stripDataParam(stripIndexParam(request)),
    context: loadContext,
    params,
  });

  if (result === undefined) {
    throw new Error(
      `You defined an action for route "${routeId}" but didn't return ` +
        `anything from your \`action\` function. Please return a value or \`null\`.`
    );
  }

  return isResponse(result) ? result : json(result);
}

export async function callRouteLoaderRR({
  loadContext,
  loader,
  params,
  request,
  routeId,
}: {
  request: Request;
  loader: LoaderFunction;
  params: DataFunctionArgs["params"];
  loadContext: AppLoadContext;
  routeId: string;
}) {
  let result = await loader({
    request: stripDataParam(stripIndexParam(request)),
    context: loadContext,
    params,
  });

  if (result === undefined) {
    throw new Error(
      `You defined a loader for route "${routeId}" but didn't return ` +
        `anything from your \`loader\` function. Please return a value or \`null\`.`
    );
  }

  return isResponse(result) ? result : json(result);
}

function stripIndexParam(request: Request) {
  let url = new URL(request.url);
  let indexValues = url.searchParams.getAll("index");
  url.searchParams.delete("index");
  let indexValuesToKeep = [];
  for (let indexValue of indexValues) {
    if (indexValue) {
      indexValuesToKeep.push(indexValue);
    }
  }
  for (let toKeep of indexValuesToKeep) {
    url.searchParams.append("index", toKeep);
  }

  return new Request(url.href, request);
}

function stripDataParam(request: Request) {
  let url = new URL(request.url);
  url.searchParams.delete("_data");
  return new Request(url.href, request);
}

export function extractData(response: Response): Promise<unknown> {
  let contentType = response.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }

  // What other data types do we need to handle here? What other kinds of
  // responses are people going to be returning from their loaders?
  // - application/x-www-form-urlencoded ?
  // - multipart/form-data ?
  // - binary (audio/video) ?

  return response.text();
}
