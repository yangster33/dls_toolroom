import type { CoordinatePoint } from '@/utils/templateRowReader'
import type { FullAddress, TemplateValidationResult } from '@/tools/get_lonlat/TemplateReader'
import type { QueryResult as AddQueryResult } from '@/tools/get_add/ApiService'
import type { QueryResult as LonLatQueryResult } from '@/tools/get_lonlat/ApiService'

export type GeocodeMode = 'add' | 'lonlat'

export type GeocodeQueryResult = AddQueryResult | LonLatQueryResult

export type GeocodeValidation =
  | TemplateValidationResult<CoordinatePoint>
  | TemplateValidationResult<FullAddress>
