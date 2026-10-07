-- Optional card preferences and immutable calculation grouping for the 2026-10-07 rules.
-- Apply after all previous migrations. Old schemaVersion=1 wallets remain valid.
-- Access policies, optimistic RPC locking and private evidence records are unchanged.
begin;

create or replace function our_miles_private.wallet_schema()
returns jsonb language sql immutable set search_path = ''
as $function$
select $schema${
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "cards",
    "transactions",
    "offers",
    "goals",
    "mileBalance",
    "mileValueSgd"
  ],
  "properties": {
    "schemaVersion": {
      "type": "integer",
      "enum": [
        1
      ]
    },
    "cards": {
      "type": "array",
      "maxItems": 100,
      "items": {
        "$ref": "card"
      }
    },
    "transactions": {
      "type": "array",
      "maxItems": 5000,
      "items": {
        "$ref": "transaction"
      }
    },
    "offers": {
      "type": "array",
      "maxItems": 100,
      "items": {
        "$ref": "offer"
      }
    },
    "goals": {
      "type": "array",
      "maxItems": 30,
      "items": {
        "$ref": "goal"
      }
    },
    "mileBalance": {
      "$ref": "miles"
    },
    "mileValueSgd": {
      "type": "number",
      "minimum": 0.001,
      "maximum": 1
    }
  },
  "$defs": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 120,
      "pattern": "^[a-zA-Z0-9_-]+$"
    },
    "text": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240,
      "pattern": "[^[:space:]]"
    },
    "money": {
      "type": "number",
      "minimum": 0,
      "maximum": 100000000
    },
    "miles": {
      "type": "number",
      "minimum": 0,
      "maximum": 10000000000
    },
    "date": {
      "type": "string",
      "format": "date",
      "maxLength": 10
    },
    "dateTime": {
      "type": "string",
      "format": "date-time",
      "maxLength": 40
    },
    "purchaseDate": {
      "anyOf": [
        {
          "$ref": "date"
        },
        {
          "$ref": "dateTime"
        }
      ]
    },
    "url": {
      "type": "string",
      "format": "https-url",
      "maxLength": 2048
    },
    "confidence": {
      "type": "string",
      "enum": [
        "Confirmed",
        "Likely",
        "Unverified"
      ]
    },
    "category": {
      "type": "string",
      "enum": [
        "dining",
        "online",
        "shopping",
        "travel",
        "transport",
        "fuel",
        "groceries",
        "other",
        "utilities",
        "insurance",
        "education",
        "government",
        "financial"
      ]
    },
    "channel": {
      "type": "string",
      "enum": [
        "online",
        "contactless",
        "in-store"
      ]
    },
    "method": {
      "type": "string",
      "enum": [
        "card",
        "apple-pay",
        "google-pay",
        "samsung-pay",
        "mobile-wallet"
      ]
    },
    "mcc": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9999
    },
    "mccRange": {
      "type": "array",
      "minItems": 2,
      "maxItems": 2,
      "items": {
        "$ref": "mcc"
      }
    },
    "conditions": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "categories": {
          "type": "array",
          "maxItems": 20,
          "items": {
            "$ref": "category"
          }
        },
        "channels": {
          "type": "array",
          "maxItems": 5,
          "items": {
            "$ref": "channel"
          }
        },
        "paymentMethods": {
          "type": "array",
          "maxItems": 6,
          "items": {
            "$ref": "method"
          }
        },
        "currency": {
          "type": "string",
          "enum": [
            "local",
            "foreign"
          ]
        },
        "mccs": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "$ref": "mcc"
          }
        },
        "mccRanges": {
          "type": "array",
          "maxItems": 100,
          "items": {
            "$ref": "mccRange"
          }
        },
        "excludedMccs": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "$ref": "mcc"
          }
        },
        "excludedMccRanges": {
          "type": "array",
          "maxItems": 100,
          "items": {
            "$ref": "mccRange"
          }
        },
        "excludedCategories": {
          "type": "array",
          "maxItems": 20,
          "items": {
            "$ref": "category"
          }
        },
        "excludedPaymentMethods": {
          "type": "array",
          "maxItems": 6,
          "items": {
            "$ref": "method"
          }
        },
        "merchantIncludes": {
          "type": "array",
          "maxItems": 100,
          "items": {
            "$ref": "text"
          }
        },
        "excludedMerchantIncludes": {
          "type": "array",
          "maxItems": 100,
          "items": {
            "$ref": "text"
          }
        },
        "excludedMerchantWords": {
          "type": "array",
          "maxItems": 100,
          "items": {
            "$ref": "text"
          }
        },
        "excludeRecurring": {
          "type": "boolean"
        },
        "rewardPartners": {
          "type": "array",
          "maxItems": 5,
          "items": {
            "$ref": "rewardPartner"
          }
        }
      }
    },
    "card": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "templateId",
        "owner",
        "status",
        "usageKnown"
      ],
      "properties": {
        "id": {
          "$ref": "id"
        },
        "templateId": {
          "$ref": "id"
        },
        "owner": {
          "type": "string",
          "enum": [
            "Aleem",
            "Nurul"
          ]
        },
        "status": {
          "type": "string",
          "enum": [
            "active",
            "inactive",
            "unconfirmed"
          ]
        },
        "statementDay": {
          "type": "integer",
          "minimum": 1,
          "maximum": 31
        },
        "usageKnown": {
          "type": "boolean"
        },
        "openingSpendSgd": {
          "$ref": "money"
        },
        "openingPeriodStart": {
          "$ref": "date"
        },
        "openingQualifyingSpendSgd": {
          "$ref": "money"
        },
        "openingLifetimeCashbackSgd": {
          "$ref": "money"
        },
        "transferFeePerMileSgd": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "openingCapSpendSgd": {
          "$ref": "moneyByGroup"
        },
        "openingRewardSpendSgd": {
          "$ref": "moneyByGroup"
        },
        "capUsageKnown": {
          "$ref": "knownByGroup"
        },
        "selectedRewardCategory": {
          "$ref": "rewardCategory"
        },
        "selectedRewardCategoryPeriodStart": {
          "$ref": "date"
        },
        "annualQualificationStart": {
          "$ref": "date"
        },
        "annualQualificationEnd": {
          "$ref": "date"
        },
        "openingAnnualQualifyingSpendSgd": {
          "$ref": "money"
        },
        "annualUsageKnown": {
          "type": "boolean"
        }
      }
    },
    "reward": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "calculatedAt",
        "templateId",
        "ruleId",
        "ruleVersion",
        "sourceUrl",
        "lastVerifiedAt",
        "miles",
        "cashbackSgd",
        "fxFeeSgd",
        "effectiveMpd",
        "confidence",
        "bonusSpendSgd",
        "qualifyingSpendSgd",
        "welcomeContributionSgd",
        "welcomeIncrementalMiles",
        "reason",
        "warnings"
      ],
      "properties": {
        "calculatedAt": {
          "$ref": "purchaseDate"
        },
        "templateId": {
          "$ref": "id"
        },
        "ruleId": {
          "$ref": "id"
        },
        "ruleVersion": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000000
        },
        "sourceUrl": {
          "$ref": "url"
        },
        "lastVerifiedAt": {
          "$ref": "date"
        },
        "miles": {
          "$ref": "miles"
        },
        "cashbackSgd": {
          "$ref": "money"
        },
        "fxFeeSgd": {
          "$ref": "money"
        },
        "effectiveMpd": {
          "type": "number",
          "minimum": 0,
          "maximum": 1000
        },
        "confidence": {
          "$ref": "confidence"
        },
        "minimumSpendIncrementalMiles": {
          "$ref": "miles"
        },
        "bonusSpendSgd": {
          "$ref": "money"
        },
        "bonusCapGroup": {
          "$ref": "id"
        },
        "periodStart": {
          "$ref": "date"
        },
        "periodEnd": {
          "$ref": "date"
        },
        "qualifyingSpendSgd": {
          "$ref": "money"
        },
        "welcomeOfferId": {
          "$ref": "id"
        },
        "welcomeContributionSgd": {
          "$ref": "money"
        },
        "welcomeIncrementalMiles": {
          "$ref": "miles"
        },
        "reason": {
          "type": "string",
          "maxLength": 2000
        },
        "warnings": {
          "type": "array",
          "maxItems": 30,
          "items": {
            "type": "string",
            "maxLength": 1000
          }
        },
        "roundingGroup": {
          "$ref": "id"
        },
        "bonusRoundingGroup": {
          "$ref": "id"
        }
      }
    },
    "transaction": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "cardId",
        "amountSgd",
        "merchant",
        "category",
        "channel",
        "paymentMethod",
        "currency",
        "date",
        "reward"
      ],
      "properties": {
        "id": {
          "$ref": "id"
        },
        "cardId": {
          "$ref": "id"
        },
        "amountSgd": {
          "$ref": "money"
        },
        "merchant": {
          "$ref": "text"
        },
        "category": {
          "$ref": "category"
        },
        "channel": {
          "$ref": "channel"
        },
        "paymentMethod": {
          "$ref": "method"
        },
        "currency": {
          "type": "string",
          "pattern": "^[A-Z]{3}$"
        },
        "date": {
          "$ref": "purchaseDate"
        },
        "mcc": {
          "$ref": "mcc"
        },
        "mccConfidence": {
          "$ref": "confidence"
        },
        "excluded": {
          "type": "boolean"
        },
        "processedOverseas": {
          "type": "boolean"
        },
        "postedDate": {
          "$ref": "date"
        },
        "status": {
          "type": "string",
          "enum": [
            "pending",
            "posted",
            "reversed"
          ]
        },
        "reward": {
          "$ref": "reward"
        },
        "recurring": {
          "type": "boolean"
        },
        "rewardPartner": {
          "$ref": "rewardPartner"
        }
      }
    },
    "offer": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "cardId",
        "name",
        "startsOn",
        "deadline",
        "tiers",
        "openingSpendSgd",
        "plannedNaturalSpendSgd",
        "sourceUrl",
        "verified",
        "eligibilityConfirmed"
      ],
      "properties": {
        "id": {
          "$ref": "id"
        },
        "cardId": {
          "$ref": "id"
        },
        "name": {
          "$ref": "text"
        },
        "startsOn": {
          "$ref": "date"
        },
        "deadline": {
          "$ref": "date"
        },
        "tiers": {
          "type": "array",
          "minItems": 1,
          "maxItems": 20,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "spendSgd",
              "miles"
            ],
            "properties": {
              "spendSgd": {
                "$ref": "money"
              },
              "miles": {
                "$ref": "miles"
              }
            }
          }
        },
        "openingSpendSgd": {
          "$ref": "money"
        },
        "plannedNaturalSpendSgd": {
          "$ref": "money"
        },
        "sourceUrl": {
          "anyOf": [
            {
              "$ref": "url"
            },
            {
              "type": "string",
              "enum": [
                ""
              ]
            }
          ]
        },
        "verified": {
          "type": "boolean"
        },
        "eligibilityConfirmed": {
          "type": "boolean"
        },
        "conditions": {
          "$ref": "conditions"
        }
      }
    },
    "goal": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "destination",
        "targetMiles"
      ],
      "properties": {
        "id": {
          "$ref": "id"
        },
        "name": {
          "$ref": "text"
        },
        "destination": {
          "$ref": "text"
        },
        "targetMiles": {
          "type": "number",
          "minimum": 1,
          "maximum": 10000000000
        },
        "targetDate": {
          "$ref": "date"
        }
      }
    },
    "rewardCategory": {
      "type": "string",
      "enum": [
        "beauty-wellness",
        "dining",
        "entertainment",
        "family",
        "fashion",
        "transport",
        "travel"
      ]
    },
    "rewardPartner": {
      "type": "string",
      "enum": [
        "singapore-airlines",
        "scoot",
        "krisshop",
        "krisplus",
        "pelago"
      ]
    },
    "moneyByGroup": {
      "type": "object",
      "properties": {},
      "additionalProperties": {
        "$ref": "money"
      },
      "propertyNames": {
        "$ref": "id"
      },
      "maxProperties": 100
    },
    "knownByGroup": {
      "type": "object",
      "properties": {},
      "additionalProperties": {
        "type": "boolean"
      },
      "propertyNames": {
        "$ref": "id"
      },
      "maxProperties": 100
    }
  }
}$schema$::jsonb;
$function$;

-- Explicit record schemas are the only exception to closed object properties.
create or replace function our_miles_private.valid_json(value jsonb, spec jsonb, definitions jsonb)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare
  field text;
  property_spec jsonb;
  item jsonb;
  actual_type text;
  raw text;
  number_value numeric;
begin
  if value is null or spec is null then return false; end if;
  if spec ? '$ref' then return our_miles_private.valid_json(value, definitions -> (spec ->> '$ref'), definitions); end if;
  if spec ? 'anyOf' then
    for item in select jsonb_array_elements(spec -> 'anyOf') loop
      if our_miles_private.valid_json(value, item, definitions) then return true; end if;
    end loop;
    return false;
  end if;
  actual_type := jsonb_typeof(value);
  if spec ->> 'type' = 'integer' then
    if actual_type <> 'number' then return false; end if;
    number_value := (value #>> '{}')::numeric;
    if trunc(number_value) <> number_value then return false; end if;
  elsif actual_type is distinct from spec ->> 'type' then return false;
  end if;
  if spec ? 'enum' and not ((spec -> 'enum') @> jsonb_build_array(value)) then return false; end if;
  if actual_type = 'object' then
    if spec ? 'maxProperties' and (select count(*) from jsonb_object_keys(value)) > (spec ->> 'maxProperties')::int then return false; end if;
    for field in select jsonb_object_keys(value) loop
      if spec ? 'propertyNames' and not our_miles_private.valid_json(to_jsonb(field), spec -> 'propertyNames', definitions) then return false; end if;
      if coalesce(spec -> 'properties' ? field, false) then
        property_spec := spec -> 'properties' -> field;
      elsif jsonb_typeof(spec -> 'additionalProperties') = 'object' then
        property_spec := spec -> 'additionalProperties';
      else return false;
      end if;
      if not our_miles_private.valid_json(value -> field, property_spec, definitions) then return false; end if;
    end loop;
    for field in select jsonb_array_elements_text(coalesce(spec -> 'required', '[]'::jsonb)) loop
      if not value ? field then return false; end if;
    end loop;
  elsif actual_type = 'array' then
    if spec ? 'maxItems' and jsonb_array_length(value) > (spec ->> 'maxItems')::int then return false; end if;
    if spec ? 'minItems' and jsonb_array_length(value) < (spec ->> 'minItems')::int then return false; end if;
    for item in select jsonb_array_elements(value) loop
      if not our_miles_private.valid_json(item, spec -> 'items', definitions) then return false; end if;
    end loop;
  elsif actual_type = 'string' then
    raw := value #>> '{}';
    if spec ? 'minLength' and length(raw) < (spec ->> 'minLength')::int then return false; end if;
    if spec ? 'maxLength' and length(raw) > (spec ->> 'maxLength')::int then return false; end if;
    if spec ? 'pattern' and raw !~ (spec ->> 'pattern') then return false; end if;
    if spec ->> 'format' = 'date' then
      if raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(raw::date, 'YYYY-MM-DD') <> raw then return false; end if;
    elsif spec ->> 'format' = 'date-time' then
      if raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then return false; end if;
      perform raw::timestamptz;
      if to_char(substring(raw from 1 for 10)::date, 'YYYY-MM-DD') <> substring(raw from 1 for 10) then return false; end if;
    elsif spec ->> 'format' = 'https-url' then
      if raw !~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$' then return false; end if;
    end if;
  elsif actual_type = 'number' then
    number_value := (value #>> '{}')::numeric;
    if spec ? 'minimum' and number_value < (spec ->> 'minimum')::numeric then return false; end if;
    if spec ? 'maximum' and number_value > (spec ->> 'maximum')::numeric then return false; end if;
  end if;
  return true;
exception when others then return false;
end;
$$;

create or replace function our_miles_private.valid_wallet(value jsonb)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare
  spec jsonb := our_miles_private.wallet_schema();
  collection text;
  entry jsonb;
  tier jsonb;
  previous_spend numeric;
  previous_miles numeric;
begin
  if value is null or octet_length(value::text) > 1048576 then return false; end if;
  if not our_miles_private.valid_json(value, spec, spec -> '$defs') then return false; end if;
  foreach collection in array array['cards','transactions','offers','goals'] loop
    if exists (select 1 from jsonb_array_elements(value -> collection) as records(entry)
      group by records.entry ->> 'id' having count(*) > 1) then return false; end if;
  end loop;
  foreach collection in array array['transactions','offers'] loop
    for entry in select jsonb_array_elements(value -> collection) loop
      if not exists (select 1 from jsonb_array_elements(value -> 'cards') as cards(card)
        where cards.card ->> 'id' = entry ->> 'cardId') then return false; end if;
    end loop;
  end loop;
  for entry in select jsonb_array_elements(value -> 'cards') loop
    if entry ? 'annualQualificationStart' and entry ? 'annualQualificationEnd'
      and entry ->> 'annualQualificationEnd' <= entry ->> 'annualQualificationStart' then return false; end if;
    if coalesce((entry ->> 'annualUsageKnown')::boolean, false) then
      if not (entry ? 'annualQualificationStart' and entry ? 'annualQualificationEnd') then return false; end if;
      if substring(entry ->> 'annualQualificationStart' from 9 for 2) <> '01'
        or to_char((entry ->> 'annualQualificationStart')::date + interval '1 year', 'YYYY-MM-DD') <> entry ->> 'annualQualificationEnd' then return false; end if;
    end if;
  end loop;
  for entry in select jsonb_array_elements(value -> 'offers') loop
    if entry ->> 'deadline' < entry ->> 'startsOn' then return false; end if;
    if (entry ->> 'verified')::boolean and entry ->> 'sourceUrl' = '' then return false; end if;
    previous_spend := -1;
    previous_miles := -1;
    for tier in select jsonb_array_elements(entry -> 'tiers') loop
      if (tier ->> 'spendSgd')::numeric <= previous_spend or (tier ->> 'miles')::numeric < previous_miles then return false; end if;
      previous_spend := (tier ->> 'spendSgd')::numeric;
      previous_miles := (tier ->> 'miles')::numeric;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;

-- CREATE OR REPLACE retains existing privileges; enforce private helper access explicitly.
revoke execute on function our_miles_private.wallet_schema() from public, anon, authenticated;
revoke execute on function our_miles_private.valid_json(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function our_miles_private.valid_wallet(jsonb) from public, anon, authenticated;

commit;
