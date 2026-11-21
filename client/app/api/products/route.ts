import { NextRequest, NextResponse } from "next/server";
import { handleGetProducts as handleCommerceProducts } from "@server/http/routes/products-handler";
import {
  searchProducts,
  ValidationError,
  DependencyUnavailableError,
  type SearchOptions,
} from "@server/discovery/search-service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Explicitly opted-in local fixture mode; live discovery stays OpenSearch-based.
  if (process.env.SMARTTIJORI_DEMO_MODE === "true" || process.env.ST_CATALOG_SOURCE === "postgres") {
    return handleCommerceProducts(request);
  }

  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const city = searchParams.get("city") ?? undefined;
    const storeId = searchParams.get("storeId") ?? undefined;
    const rawLimit = searchParams.get("limit");
    const rawMinPrice = searchParams.get("minPricePaise") ?? searchParams.get("minPrice");
    const rawMaxPrice = searchParams.get("maxPricePaise") ?? searchParams.get("maxPrice");
    const rawIncludeUnavailable = searchParams.get("includeUnavailable");

    const searchOptions: SearchOptions = {
      q,
      category,
      city,
      storeId,
    };

    if (rawLimit !== null) {
      const parsedLimit = Number(rawLimit);
      if (isNaN(parsedLimit) || parsedLimit <= 0 || !Number.isInteger(parsedLimit)) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Query parameter 'limit' must be a positive integer between 1 and 24",
            },
          },
          { status: 400 }
        );
      }
      searchOptions.limit = parsedLimit;
    }

    if (rawMinPrice !== null) {
      const parsedMinPrice = Number(rawMinPrice);
      if (isNaN(parsedMinPrice) || parsedMinPrice < 0) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Query parameter 'minPrice' must be a non-negative number",
            },
          },
          { status: 400 }
        );
      }
      searchOptions.minPricePaise = parsedMinPrice;
    }

    if (rawMaxPrice !== null) {
      const parsedMaxPrice = Number(rawMaxPrice);
      if (isNaN(parsedMaxPrice) || parsedMaxPrice < 0) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Query parameter 'maxPrice' must be a non-negative number",
            },
          },
          { status: 400 }
        );
      }
      searchOptions.maxPricePaise = parsedMaxPrice;
    }

    if (rawIncludeUnavailable !== null) {
      searchOptions.includeUnavailable = rawIncludeUnavailable.toLowerCase() === "true";
    }

    const result = await searchProducts(searchOptions);

    return NextResponse.json({
      items: result.items,
    });
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    if (error instanceof DependencyUnavailableError) {
      return NextResponse.json(
        {
          error: {
            code: "DEPENDENCY_UNAVAILABLE",
            message: "Search service is temporarily unavailable. Please try again shortly.",
          },
        },
        { status: 503 }
      );
    }

    // Default safe error response: never expose stack traces or internal details
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred while processing your search request.",
        },
      },
      { status: 500 }
    );
  }
}
