using System;
using System.Collections.Generic;

using Mafi.Core.Buildings.Farms;
using Mafi.Core.Factory.Transports;
using Mafi.Core.Ports.Io;
using Mafi.Core.Products;

internal sealed partial class GameSnapshotCollector
{
    private string getCropFarmFertilizerProductId(Farm farm, List<FertilizerSource> fertilizers)
    {
        bool pipeIsAmbiguous;
        string pipeProductId = getCropFarmPipeFertilizerProductId(
            farm,
            out pipeIsAmbiguous);
        if (pipeIsAmbiguous)
        {
            return null;
        }

        if (pipeProductId != null)
        {
            return pipeProductId;
        }

        if (!farm.StoredFertilizerCount.IsPositive)
        {
            return null;
        }

        string match = null;
        foreach (FertilizerSource fertilizer in fertilizers)
        {
            if (fertilizer.Parameters.MaxFertility != farm.MaxFertilityProvidedByFertilizer
                || fertilizer.Parameters.FertilityPerQuantity != farm.FertilityPerFertilizer) continue;
            // Identical native parameters do not identify one product uniquely.
            string productId = getFertilizerProductId(fertilizer.Product.SlimId);
            if (match != null || productId == null) return null;
            match = productId;
        }
        return match;
    }

    private string getCropFarmPipeFertilizerProductId(
        Farm farm,
        out bool isAmbiguous)
    {
        isAmbiguous = false;

        foreach (IoPort port in farm.Ports)
        {
            if (port.Name != Farm.INPUT_FERTILIZER_PORT_NAME
                || !port.ConnectedPort.HasValue)
            {
                continue;
            }

            Transport transport = port.ConnectedPort.Value.OwnerEntity as Transport;
            if (transport == null)
            {
                continue;
            }

            string transportedProductId = null;
            foreach (TransportedProductMutable product in transport.TransportedProducts)
            {
                string productId = getFertilizerProductId(product.SlimId);
                if (productId == null)
                {
                    isAmbiguous = true;
                    return null;
                }
                if (transportedProductId != null
                    && !String.Equals(
                        transportedProductId,
                        productId,
                        StringComparison.Ordinal))
                {
                    isAmbiguous = true;
                    return null;
                }

                transportedProductId = productId;
            }

            string lastProductId = getFertilizerProductId(
                transport.LastInsertedProduct);
            if (transportedProductId != null
                && lastProductId != null
                && !String.Equals(
                    transportedProductId,
                    lastProductId,
                    StringComparison.Ordinal))
            {
                isAmbiguous = true;
                return null;
            }

            return transportedProductId ?? lastProductId;
        }

        return null;
    }

    private string getFertilizerProductId(ProductSlimId slimId)
    {
        ProductProto product = slimId.ToFullOrPhantom(m_productsManager.SlimIdManager);
        if (!product.HasParam<FertilizerProductParam>()) return null;
        string productId = product.Id.ToString();
        // Keep unsupported fertilizers unidentified, matching the client domain.
        return productId == SnapshotTracking.OrganicFertilizerProductId
            || productId == SnapshotTracking.FertilizerIProductId
            || productId == SnapshotTracking.FertilizerIiProductId ? productId : null;
    }
}
