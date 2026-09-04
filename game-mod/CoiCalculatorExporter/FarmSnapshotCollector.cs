using System;

using Mafi;
using Mafi.Core.Buildings.Farms;
using Mafi.Core.Factory.Transports;
using Mafi.Core.Ports.Io;
using Mafi.Core.Products;

internal sealed partial class GameSnapshotCollector
{
    private string getCropFarmFertilizerProductId(Farm farm)
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

        Percent maximumFertility = farm.MaxFertilityProvidedByFertilizer;
        Percent fertilityPerUnit = farm.FertilityPerFertilizer;
        if (maximumFertility == 100.Percent()
            && fertilityPerUnit == 1.Percent())
        {
            return SnapshotTracking.OrganicFertilizerProductId;
        }
        if (maximumFertility == 120.Percent()
            && fertilityPerUnit == 2.Percent())
        {
            return SnapshotTracking.FertilizerIProductId;
        }
        if (maximumFertility == 140.Percent()
            && fertilityPerUnit == 2.5.Percent())
        {
            return SnapshotTracking.FertilizerIiProductId;
        }

        return null;
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
        string productId = product.Id.ToString();

        if (String.Equals(productId, SnapshotTracking.OrganicFertilizerProductId, StringComparison.Ordinal)
            || String.Equals(productId, SnapshotTracking.FertilizerIProductId, StringComparison.Ordinal)
            || String.Equals(productId, SnapshotTracking.FertilizerIiProductId, StringComparison.Ordinal))
        {
            return productId;
        }

        return null;
    }
}
