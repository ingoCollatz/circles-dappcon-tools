import { createLiveSearchStore } from "../createLiveSearchStore";
import Web3 from "web3";
import {CirclesRpc} from "../../../consts";

export type FindCrcBalanceSearchArgs = {
    address: string
}

export const createFindCrcBalance = () => createLiveSearchStore<FindCrcBalanceSearchArgs, string | undefined>(200, async (searchArg: FindCrcBalanceSearchArgs) => {
    if (!searchArg.address || searchArg.address.length !== 42 || !new Web3().utils.isAddress(searchArg.address)) {
        return undefined;
    }

    const balanceResponse = await fetch(CirclesRpc, {
        "headers": {
            "content-type": "application/json",
        },
        "body": `{
            "jsonrpc":"2.0",
            "method":"circles_getTotalBalance",
            "params":["${searchArg.address}"],
            "id":1
        }`,
        "method": "POST"
    });

    const balanceResponseJson = await balanceResponse.json();
    return balanceResponseJson.result ? balanceResponseJson.result : "0";
}, undefined);
