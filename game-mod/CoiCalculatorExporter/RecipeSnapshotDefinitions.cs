using System;
using System.Collections.Generic;

using Mafi.Core.Factory.Machines;
using Mafi.Core.Factory.Recipes;

internal sealed partial class GameSnapshotCollector
{
    private sealed class MachineRecipeDefinitions
    {
        public readonly List<RecipeProto> Recipes = new List<RecipeProto>();
        private readonly MachineProto m_machine;
        private readonly Dictionary<RecipeProto, MachineRecipeDefinition> m_definitions =
            new Dictionary<RecipeProto, MachineRecipeDefinition>();

        public MachineRecipeDefinitions(MachineProto machine)
        {
            m_machine = machine;
            foreach (RecipeProto recipe in machine.Recipes) Recipes.Add(recipe);
        }

        public MachineRecipeDefinition Get(RecipeProto recipe)
        {
            MachineRecipeDefinition definition;
            if (!m_definitions.TryGetValue(recipe, out definition))
            {
                definition = new MachineRecipeDefinition(m_machine, recipe);
                m_definitions.Add(recipe, definition);
            }
            return definition;
        }
    }

    private sealed class MachineRecipeDefinition
    {
        public readonly IRecipeForUi RecipeForUi;
        private readonly string m_id;
        private readonly string m_name;
        private readonly double m_durationSeconds;
        private readonly double m_electricityMultiplier;
        private readonly bool m_recyclesInputs;
        private readonly List<AreaRecipeProductSnapshot> m_inputs = new List<AreaRecipeProductSnapshot>();
        private readonly List<AreaRecipeProductSnapshot> m_outputs = new List<AreaRecipeProductSnapshot>();

        public MachineRecipeDefinition(MachineProto machine, RecipeProto recipe)
        {
            RecipeForUi = machine.GetRecipeForUi(recipe);
            m_id = recipe.Id.ToString();
            string name = recipe.Strings.Name.TranslatedString;
            m_name = String.IsNullOrWhiteSpace(name) ? m_id : name;
            m_durationSeconds = Math.Max(0.001, RecipeForUi.Duration.Seconds.ToDouble());
            m_electricityMultiplier = recipe.PowerMultiplier.ToDouble();
            m_recyclesInputs = recipe.RecyclablesOutput.HasValue;

            foreach (RecipeInput input in RecipeForUi.AllUserVisibleInputs)
            {
                m_inputs.Add(new AreaRecipeProductSnapshot(
                    input.Product.Id.ToString(), getProtoName(input.Product), input.Quantity.Value));
            }
            foreach (RecipeOutput output in RecipeForUi.AllUserVisibleOutputs)
            {
                m_outputs.Add(new AreaRecipeProductSnapshot(
                    output.Product.Id.ToString(), getProtoName(output.Product), output.Quantity.Value));
            }
        }

        public AreaRecipeSnapshot CreateSnapshot(bool assigned)
        {
            // Definition lists are read-only after construction. Assignment and
            // observed recycling sources belong to a fresh per-building snapshot.
            return new AreaRecipeSnapshot(m_id, m_name, m_durationSeconds, assigned, m_inputs, m_outputs) {
                ElectricityMultiplier = m_electricityMultiplier,
                RecyclesInputs = m_recyclesInputs,
            };
        }
    }
}
