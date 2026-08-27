import {
  DEFAULT_PLATFORM_COMMISSION_PCT,
  SETTLEMENT_STATUS,
  SETTLEMENT_STATUS_LABEL,
} from '@/constants/domain'
import { formatMoney } from '@/lib/eventMappers'

export { SETTLEMENT_STATUS, SETTLEMENT_STATUS_LABEL }

export function computeFeeSplit(feeAmount, platformPct = DEFAULT_PLATFORM_COMMISSION_PCT) {
  const fee = Math.max(0, Number(feeAmount) || 0)
  const pct = Math.min(100, Math.max(0, Number(platformPct) || DEFAULT_PLATFORM_COMMISSION_PCT))
  const platformFee = Math.round(((fee * pct) / 100) * 100) / 100
  const organizerShare = Math.round((fee - platformFee) * 100) / 100
  return {
    fee,
    platformFee,
    organizerShare,
    commissionPercent: pct,
  }
}

/** Prefer DB snapshot columns; fall back to live 20% math for older rows. */
export function resolveRegistrationSplit(row, platformPct = DEFAULT_PLATFORM_COMMISSION_PCT) {
  const fee = Number(row?.feeAmount ?? row?.fee_amount ?? 0) || 0
  const hasSnapshot =
    Number(row?.platformFee ?? row?.platform_fee ?? 0) > 0 ||
    Number(row?.organizerShare ?? row?.organizer_share ?? 0) > 0 ||
    ['held', 'settled', 'void'].includes(
      String(row?.settlementStatus || row?.settlement_status || ''),
    )

  if (hasSnapshot) {
    const platformFee = Number(row.platformFee ?? row.platform_fee ?? 0) || 0
    const organizerShare = Number(row.organizerShare ?? row.organizer_share ?? 0) || 0
    const commissionPercent =
      Number(row.commissionPercent ?? row.commission_percent ?? platformPct) || platformPct
    return { fee, platformFee, organizerShare, commissionPercent }
  }

  return computeFeeSplit(fee, platformPct)
}

export function isEarningsEligible(row) {
  const status = row?.paymentStatus || row?.payment_status
  return ['paid', 'partially_refunded', 'forfeited'].includes(status)
}

export function formatSplitLine(row, currency = 'pkr') {
  const split = resolveRegistrationSplit(row)
  if (split.fee <= 0) return null
  return `Platform ${formatMoney(split.platformFee, currency)} · Organizer ${formatMoney(split.organizerShare, currency)}`
}
