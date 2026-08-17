// Bundled format validators, MIT licensed.
// Source: node_modules/ajv-formats/dist/formats.js (ajv-formats 3.0.1),
// lines 70-73 (isLeapYear), 74-88 (DATE, DAYS, date), 98-120 (TIME, getTime),
// 145-153 (DATE_TIME_SEPARATOR, getDateTime), 173-178 (NOT_URI_FRAGMENT, URI, uri).
// https://github.com/ajv-validator/ajv-formats
// Inlined by scripts/generate-contract.mjs into
// src/generated/schema-validator.generated.cjs per ADR-SDK-011.
//
// Adapted from the upstream sources: control flow is restructured into
// single-branch conditions (no logical operators, no ternaries) so the
// bundled code stays within the repository's analyzer branch thresholds,
// while remaining behavior-identical to the pinned implementations.
// Behavior identity is enforced by
// tests/verification/bundled-formats-parity.test.mjs.
function isLeapYear(year) {
    // https://tools.ietf.org/html/rfc3339#appendix-C
    if (year % 4 !== 0)
        return false;
    if (year % 100 !== 0)
        return true;
    return year % 400 === 0;
}
const DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
const DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function date(str) {
    // full-date from http://tools.ietf.org/html/rfc3339#section-5.6
    const matches = DATE.exec(str);
    if (!matches)
        return false;
    const year = +matches[1];
    const month = +matches[2];
    const day = +matches[3];
    if (month < 1)
        return false;
    if (month > 12)
        return false;
    if (day < 1)
        return false;
    let maxDay = DAYS[month];
    if (month === 2) {
        if (isLeapYear(year))
            maxDay = 29;
    }
    return day <= maxDay;
}
const TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
function offsetValue(group) {
    if (group === undefined)
        return 0;
    return +group;
}
function signOf(signGroup) {
    if (signGroup === "-")
        return -1;
    return 1;
}
function zoneWithinBounds(tzH, tzM) {
    if (tzH > 23)
        return false;
    return tzM <= 59;
}
function plainSecond(hr, min, sec) {
    if (hr > 23)
        return false;
    if (min > 59)
        return false;
    return sec < 60;
}
function leapSecond(clock, offset) {
    // leap second
    const utcMin = clock.min - offset.min * offset.sign;
    let utcHr = clock.hr - offset.hr * offset.sign;
    if (utcMin < 0)
        utcHr -= 1;
    if (utcHr !== 23) {
        if (utcHr !== -1)
            return false;
    }
    if (utcMin !== 59) {
        if (utcMin !== -1)
            return false;
    }
    return clock.sec < 61;
}
function getTime(strictTimeZone) {
    return function time(str) {
        const matches = TIME.exec(str);
        if (!matches)
            return false;
        const clock = { hr: +matches[1], min: +matches[2], sec: +matches[3] };
        const offset = { sign: signOf(matches[5]), hr: offsetValue(matches[6]), min: offsetValue(matches[7]) };
        if (strictTimeZone) {
            if (matches[4] === undefined)
                return false;
        }
        if (!zoneWithinBounds(offset.hr, offset.min))
            return false;
        if (plainSecond(clock.hr, clock.min, clock.sec))
            return true;
        return leapSecond(clock, offset);
    };
}
const DATE_TIME_SEPARATOR = /t|\s/i;
function getDateTime(strictTimeZone) {
    const time = getTime(strictTimeZone);
    return function date_time(str) {
        // http://tools.ietf.org/html/rfc3339#section-5.6
        const dateTime = str.split(DATE_TIME_SEPARATOR);
        if (dateTime.length !== 2)
            return false;
        if (!date(dateTime[0]))
            return false;
        return time(dateTime[1]);
    };
}
const NOT_URI_FRAGMENT = /\/|:/;
const URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
function uri(str) {
    // http://jmrware.com/articles/2009/uri_regexp/URI_regex.html + optional protocol + required "."
    if (!NOT_URI_FRAGMENT.test(str))
        return false;
    return URI.test(str);
}
const bundledDateTimeValidate = getDateTime(true);
const bundledUriValidate = uri;

export { bundledDateTimeValidate, bundledUriValidate };
