import {createLiveSearchStore} from "../createLiveSearchStore";
import Web3 from "web3";
import {HUB_ABI} from "../../../abis/hub";
import {HubAddress, PathfinderApi} from "../../../consts";
import {ZERO_ADDRESS} from "@safe-global/protocol-kit/dist/src/utils/constants";
import type {PaymentPath} from "../../../models/paymentPath";

export type PaymentPathSearchArgs = {
    from: string
    to: string
    amount: string,
    web3: Web3
}

export const EmptyPath: PaymentPath = {
    requestedAmount: "0",
    maxFlow: "0",
    path: []
}

export const createFindPaymentPath = () => createLiveSearchStore<PaymentPathSearchArgs, PaymentPath>(200, async (searchArgs: PaymentPathSearchArgs) => {
    // Check if 'from' and 'to' are valid addresses and are signed up at the hub
    if (!searchArgs.from || searchArgs.from.length !== 42 || !new Web3().utils.isAddress(searchArgs.from)) {
        return EmptyPath;
    }
    if (!searchArgs.to || searchArgs.to.length !== 42 || !new Web3().utils.isAddress(searchArgs.to)) {
        return EmptyPath;
    }

    // Check if 'from' and 'to' are signed up at the Circles Hub
    const hubContract = new searchArgs.web3.eth.Contract(<any>HUB_ABI, HubAddress);
    const isSignedUpResult = await Promise.all([
        hubContract.methods.userToToken(searchArgs.from).call()
        , hubContract.methods.organizations(searchArgs.from).call()
        , hubContract.methods.userToToken(searchArgs.to).call()
        , hubContract.methods.organizations(searchArgs.to).call()]);

    if ((!isSignedUpResult[0] || isSignedUpResult[0] == ZERO_ADDRESS) && !isSignedUpResult[1]) {
        console.warn(`'from' address ${searchArgs.from} is not signed up at the Circles Hub`);
        return EmptyPath;
    }

    if ((!isSignedUpResult[2] || isSignedUpResult[2] == ZERO_ADDRESS) && !isSignedUpResult[3]) {
        console.warn(`'to' address ${searchArgs.to} is not signed up at the Circles Hub`);
        return EmptyPath;
    }

    try {
        if (!searchArgs.amount || !searchArgs.web3.utils.toBN(searchArgs.amount)) {
            console.warn(`'amount' ${searchArgs.amount} is not a valid BN number`);
            return EmptyPath;
        }
    } catch (e) {
        console.error(e);
        console.warn(`'amount' ${searchArgs.amount} is not a valid BN number`);
        return EmptyPath;
    }

    const query = {
        method: 'compute_transfer',
        params: {from: searchArgs.from, to: searchArgs.to, value: searchArgs.amount}
    };

    const response = await fetch(PathfinderApi, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
    });

    if (!response.ok) {
        throw new Error(`Error calling API: ${response.status}`);
    }

    const parsed = await response.json();

    const transformedResponse: any = {
        data: {
            directPath: {
                requestedAmount: searchArgs.amount,
                flow: parsed.result.maxFlowValue,
                transfers: parsed.result.transferSteps.map((step: any) => ({
                    from: step.from,
                    to: step.to,
                    tokenOwner: step.token_owner,
                    value: step.value
                })),
                isValid: parsed.result.final
            }
        }
    };

    const requestedAmount = transformedResponse.data?.directPath?.requestedAmount;
    const maxFlow = transformedResponse.data?.directPath?.flow;
    const path = transformedResponse.data?.directPath?.transfers;
    const isValid = transformedResponse.data?.directPath?.isValid;

    return <PaymentPath>{
        requestedAmount: requestedAmount ? requestedAmount : "0",
        maxFlow: maxFlow ? maxFlow : "0",
        path: path ? path : [],
        isValid: isValid
    };
}, undefined);
