import { router } from "expo-router";
import { useState } from "react";
import ContentContainer from "@/components/ContentContainer";
import { TextInput } from "@/components/TextInput";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();

  const handleSearch = () => {
    if (trimmedQuery.length > 0) {
      router.push({
        pathname: "/search-results",
        params: { query: trimmedQuery },
      });
    }
  };

  return (
    <ContentContainer
      headerTitle="Search"
      hideBackButton
      rightAction={{
        icon: "search",
        onPress: handleSearch,
        show: trimmedQuery.length > 0,
      }}
    >
      <TextInput
        onChangeText={setQuery}
        onSubmit={handleSearch}
        placeholder="Search for a stop"
        value={query}
      />
    </ContentContainer>
  );
}
