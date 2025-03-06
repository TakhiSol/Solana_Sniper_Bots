import { publicKey, struct, u64, i64, bool, GetStructureSchema } from "@raydium-io/raydium-sdk"

export type BONDINGCURVECUSTOMLAYOUT = typeof BONDING_CURV
export type BONDINGCURVECUSTOM = GetStructureSchema<BONDINGCURVECUSTOMLAYOUT>

export const BONDING_CURV = struct([
    // u64('initialized'),
    // publicKey('authority'),
    // publicKey('feeRecipient'),
    // u64('initialVirtualTokenReserves'),
    // u64('initialVirtualSolReserves'),
    // u64('initialRealTokenReserves'),
    // u64('tokenTotalSupply'),
    // u64('feeBasisPoints'),
    u64('virtualTokenReserves'),
    u64('virtualSolReserves'),
    u64('realTokenReserves'),
    u64('realSolReserves'),
    u64('tokenTotalSupply'),
    bool('complete'),
])