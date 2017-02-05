import { Logger } from "log4js";

export function safe<T>(logger: Logger, func: (e: T) => Promise<void>) {
    return (event: T) => func(event).catch((e: any) => printError(logger, e));
}

export function printError(logger: Logger, e: any) {
    if (e.toString == null || e.stack == null) {
        logger.error("Unsupported error object:" + e);
        return;
    }
    logger.error(
        e.toString() + "\n"
        + (<string>e.stack)
            .split("\n")
            .map(x => x.replace(/(.*?)@(.*)/, "    at $1 ($2)"))
            .map(color)
            .join("\n"),
    );
}

function color(x: string) {
    if (
        [
            "__emitToSubscription",
            "callFn",
            "defineIteratorMethods/</prototype[method]",
            "invoke",
            "step",
            "timeslice",
            "tryCatch",
        ]
            .map(y => `    at ${y} `)
            .some(y => x.startsWith(y))
        ||
        [
            "_asyncToGenerator(/<)*",
            "_callee.*\\$",
            "fetch(/<)*",
            "next(/<)*",
        ]
            .map(y => `^    at ${y} `)
            .some(y => new RegExp(y).test(x))
    ) {
        return `\u001b[90m${x}\u001b[39m`;
    }
    return x;
}