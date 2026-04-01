import { router, useSegments } from "expo-router";
import type { ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Header, type HeaderRightAction } from "@/components/Header";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useScrollIndicator } from "@/hooks/useScrollIndicator";
import { n } from "@/utils/scaling";

interface ContentContainerProps {
  children?: ReactNode;
  contentGap?: number;
  contentWidth?: "wide" | "normal";
  headerTitle?: string;
  hideBackButton?: boolean;
  rightAction?: HeaderRightAction;
}

export default function ContentContainer({
  headerTitle,
  children,
  hideBackButton = false,
  rightAction,
  contentWidth = "normal",
  contentGap = 47,
}: ContentContainerProps) {
  const segments = useSegments();
  const hasNavbar = segments?.[0] === "(tabs)";
  const { invertColors } = useInvertColors();
  const {
    handleScroll,
    scrollIndicatorHeight,
    scrollIndicatorPosition,
    setContentHeight,
    setScrollViewHeight,
  } = useScrollIndicator();

  const canSwipeBack = Boolean(headerTitle) && !hideBackButton;
  const backgroundColor = invertColors ? "white" : "black";
  const contentWidthStyle =
    contentWidth === "wide" ? styles.contentWide : styles.contentNormal;
  const scrollIndicatorPositionStyle =
    contentWidth === "wide"
      ? styles.scrollIndicatorWide
      : styles.scrollIndicatorNormal;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <SwipeBackContainer enabled={canSwipeBack} onSwipeBack={handleBack}>
      <View style={[styles.container, { backgroundColor }]}>
        {headerTitle && (
          <Header
            headerTitle={headerTitle}
            hideBackButton={hideBackButton}
            rightAction={rightAction}
          />
        )}
        <View
          style={[
            styles.scrollWrapper,
            !hasNavbar && styles.scrollWrapperWithoutNavbar,
          ]}
        >
          <Animated.ScrollView
            onLayout={(event) =>
              setScrollViewHeight(event.nativeEvent.layout.height)
            }
            onScroll={handleScroll}
            overScrollMode="never"
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            <View
              onLayout={(event) =>
                setContentHeight(event.nativeEvent.layout.height)
              }
              style={[
                styles.content,
                contentWidthStyle,
                { gap: n(contentGap) },
              ]}
            >
              {children ?? null}
            </View>
          </Animated.ScrollView>
          {scrollIndicatorHeight > 0 && (
            <View
              style={[
                styles.scrollIndicatorTrack,
                scrollIndicatorPositionStyle,
                { backgroundColor: invertColors ? "black" : "white" },
              ]}
            >
              <Animated.View
                style={[
                  styles.scrollIndicatorThumb,
                  {
                    backgroundColor: invertColors ? "black" : "white",
                  },
                  {
                    height: scrollIndicatorHeight,
                    transform: [
                      {
                        translateY: scrollIndicatorPosition,
                      },
                    ],
                  },
                ]}
              />
            </View>
          )}
        </View>
      </View>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    gap: n(14),
  },
  scrollWrapper: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
    position: "relative",
  },
  scrollWrapperWithoutNavbar: {
    paddingBottom: n(20),
  },
  content: {
    flexGrow: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: n(47),
  },
  contentNormal: {
    paddingLeft: n(37),
    paddingRight: n(46),
  },
  contentWide: {
    paddingLeft: n(20),
    paddingRight: n(32),
  },
  scrollIndicatorTrack: {
    width: n(1),
    height: "100%",
    position: "absolute",
  },
  scrollIndicatorNormal: {
    right: n(34),
  },
  scrollIndicatorWide: {
    right: n(18),
  },
  scrollIndicatorThumb: {
    width: n(5),
    position: "absolute",
    right: n(-2),
  },
});
