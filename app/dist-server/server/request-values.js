export const normalizeRequiredJsonNonNegativeInteger = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
